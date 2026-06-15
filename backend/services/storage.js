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

function getSupabase() {
  if (!isCloud()) return null;
  return createClient(
    process.env.SUPABASE_URL.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  );
}

function localPath(bucket, filename) {
  return path.join(uploadsDir, bucket, filename);
}

async function uploadFile(bucket, filename, buffer, contentType) {
  if (isCloud()) {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
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
    const { data, error } = await supabase.storage.from(bucket).download(filename);
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
    const { error } = await supabase.storage.from(bucket).remove([filename]);
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
  uploadFile,
  downloadBuffer,
  deleteFile,
  resolveFilePath,
  getReadablePath: resolveFilePath,
  localPath,
};
