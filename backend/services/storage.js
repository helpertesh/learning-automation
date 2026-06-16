const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BUCKETS = {
  NOTES: 'notes',
  PAPERS: 'past-papers',
};

const uploadsDir = path.join(__dirname, '..', 'uploads');

function isCloud() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeSupabaseUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) throw new Error('SUPABASE_URL is required');
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`SUPABASE_URL is invalid: "${trimmed}"`);
  }
  // Supabase client expects the project base URL, not /rest/v1 or /storage/v1.
  return `${url.protocol}//${url.host}`;
}

function sanitizeObjectKey(key) {
  const raw = String(key ?? '');
  // Supabase Storage expects a relative path (no drive letters, no leading slash).
  const normalizedSlashes = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  const withoutTraversal = normalizedSlashes
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');

  // Remove characters that commonly break URLs/paths in object keys.
  return withoutTraversal.replace(/[\u0000-\u001F\u007F?#]+/g, '_');
}

function getSupabaseUrl() {
  return normalizeSupabaseUrl(process.env.SUPABASE_URL);
}

function getSupabase() {
  if (!isCloud()) return null;
  return createClient(
    getSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

async function getStorageHealth() {
  if (!isCloud()) {
    return { ok: true, mode: 'local' };
  }

  const rawUrl = process.env.SUPABASE_URL?.trim() || '';
  const normalizedUrl = getSupabaseUrl();
  const supabase = getSupabase();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    return {
      ok: false,
      mode: 'supabase',
      rawUrl,
      normalizedUrl,
      error: listError.message,
    };
  }

  const bucketNames = (buckets || []).map((b) => b.name);
  const missingBuckets = Object.values(BUCKETS).filter((name) => !bucketNames.includes(name));
  const testKey = `${Date.now()}-healthcheck.txt`;

  try {
    await uploadFile(BUCKETS.NOTES, testKey, Buffer.from('ok'), 'text/plain');
    await deleteFile(BUCKETS.NOTES, testKey);
  } catch (err) {
    return {
      ok: false,
      mode: 'supabase',
      rawUrl,
      normalizedUrl,
      buckets: bucketNames,
      missingBuckets,
      error: err.message,
      hint: rawUrl !== normalizedUrl
        ? 'SUPABASE_URL should be https://<project>.supabase.co (no /rest/v1 or /storage/v1)'
        : undefined,
    };
  }

  return {
    ok: true,
    mode: 'supabase',
    rawUrl,
    normalizedUrl,
    buckets: bucketNames,
    missingBuckets,
    urlNormalized: rawUrl !== normalizedUrl,
  };
}

function localPath(bucket, filename) {
  return path.join(uploadsDir, bucket, filename);
}

async function uploadFile(bucket, filename, buffer, contentType) {
  if (isCloud()) {
    const supabase = getSupabase();
    const objectKey = sanitizeObjectKey(filename);
    const { error } = await supabase.storage.from(bucket).upload(objectKey, buffer, {
      contentType: contentType || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return;
  }
  const dir = path.join(uploadsDir, bucket);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
}

async function downloadBuffer(bucket, filename) {
  if (isCloud()) {
    const supabase = getSupabase();
    const objectKey = sanitizeObjectKey(filename);
    const { data, error } = await supabase.storage.from(bucket).download(objectKey);
    if (error) throw new Error(`Storage download failed: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }
  const filePath = localPath(bucket, filename);
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  return fs.readFileSync(filePath);
}

async function deleteFile(bucket, filename) {
  if (isCloud()) {
    const supabase = getSupabase();
    const objectKey = sanitizeObjectKey(filename);
    const { error } = await supabase.storage.from(bucket).remove([objectKey]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
    return;
  }
  const filePath = localPath(bucket, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/** Resolve a readable path for text extraction (downloads to temp if cloud). */
async function resolveFilePath(bucket, filename) {
  if (!isCloud()) {
    const filePath = localPath(bucket, filename);
    if (!fs.existsSync(filePath)) throw new Error('File not found');
    return filePath;
  }
  const os = require('os');
  const tmpDir = path.join(os.tmpdir(), 'studyflow');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, filename);
  const buffer = await downloadBuffer(bucket, filename);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

module.exports = {
  BUCKETS,
  isCloud,
  getSupabaseUrl,
  getStorageHealth,
  uploadFile,
  downloadBuffer,
  deleteFile,
  resolveFilePath,
  getReadablePath: resolveFilePath,
  localPath,
};
