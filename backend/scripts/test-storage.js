#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const storage = require('../services/storage');

function normalizeSupabaseUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  const url = new URL(trimmed);
  return `${url.protocol}//${url.host}`;
}

async function main() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Raw URL:', rawUrl);
  console.log('Normalized URL:', normalizeSupabaseUrl(rawUrl));
  console.log('Key prefix:', key.slice(0, 12) + '...');
  console.log('isCloud:', storage.isCloud());

  const supabase = createClient(normalizeSupabaseUrl(rawUrl), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  console.log('listBuckets error:', listErr?.message || null);
  console.log('Buckets:', buckets?.map((b) => b.name) || []);

  const testKey = `${Date.now()}-test.txt`;
  try {
    await storage.uploadFile(storage.BUCKETS.NOTES, testKey, Buffer.from('hello'), 'text/plain');
    console.log('storage.uploadFile: OK');
    await storage.deleteFile(storage.BUCKETS.NOTES, testKey);
    console.log('storage.deleteFile: OK');
  } catch (err) {
    console.error('storage.uploadFile failed:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
