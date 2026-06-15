#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const storage = require('../services/storage');

async function testSqlite() {
  const dbPath = path.join(__dirname, '..', 'data', 'study.db');
  if (!fs.existsSync(dbPath)) {
    return { ok: false, engine: 'sqlite', message: 'study.db not found' };
  }
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const units = db.exec('SELECT COUNT(*) FROM units')[0]?.values[0]?.[0] ?? 0;
  const notes = db.exec('SELECT COUNT(*) FROM notes')[0]?.values[0]?.[0] ?? 0;
  return { ok: true, engine: 'sqlite', counts: { units, notes }, path: dbPath };
}

async function testPostgres() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return { ok: null, configured: false, message: 'DATABASE_URL not set' };

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await pool.query('SELECT 1');
    const units = (await pool.query('SELECT COUNT(*)::int AS c FROM units')).rows[0]?.c ?? 0;
    const notes = (await pool.query('SELECT COUNT(*)::int AS c FROM notes')).rows[0]?.c ?? 0;
    return { ok: true, configured: true, counts: { units, notes } };
  } catch (err) {
    return { ok: false, configured: true, message: err.message };
  } finally {
    await pool.end();
  }
}

async function main() {
  const usePg = !!process.env.DATABASE_URL?.trim();
  const engine = usePg ? 'postgres' : 'sqlite';

  console.log(`Database mode: ${engine}\n`);

  if (usePg) {
    const pg = await testPostgres();
    console.log('Supabase Postgres:', pg.ok ? 'OK' : 'FAILED', pg.counts || pg.message);
    if (storage.isCloud()) console.log('Supabase Storage: configured');
    else console.log('Supabase Storage: NOT configured (add SUPABASE_URL + key)');
  } else {
    const sq = await testSqlite();
    console.log('Local SQLite:', sq.ok ? 'OK' : 'FAILED', sq.counts || sq.message);
    console.log('\nTip: Add DATABASE_URL to .env to use Supabase');
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
