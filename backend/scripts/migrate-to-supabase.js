#!/usr/bin/env node
/**
 * One-time migration: local SQLite (study.db) + uploads → Supabase Postgres + Storage
 * Requires DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in backend/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');
const storage = require('../services/storage');

const DB_PATH = path.join(__dirname, '..', 'data', 'study.db');
const UPLOADS = path.join(__dirname, '..', 'uploads');

const TABLES = [
  'units',
  'topics',
  'notes',
  'past_papers',
  'assignments',
  'study_sessions',
  'training_logs',
  'timetable_slots',
  'notifications',
  'note_summaries',
  'quizzes',
  'quiz_questions',
  'quiz_attempts',
  'quiz_answers',
  'exam_analyses',
  'topic_weakness',
  'whatsapp_log',
  'user_it_skills',
  'daily_it_lessons',
];

const BOOL_COLS = {
  notifications: ['is_read'],
  topics: ['is_covered'],
  quiz_answers: ['is_correct'],
  daily_it_lessons: ['completed'],
};

function convertRow(table, row) {
  const out = { ...row };
  for (const col of BOOL_COLS[table] || []) {
    if (col in out && out[col] != null) out[col] = !!out[col];
  }
  return out;
}

async function migrateTable(pool, sqliteDb, table) {
  const result = sqliteDb.exec(`SELECT * FROM ${table}`);
  if (!result[0]?.values?.length) {
    console.log(`  ${table}: 0 rows (skip)`);
    return 0;
  }

  const cols = result[0].columns;
  let count = 0;

  for (const values of result[0].values) {
    const row = convertRow(table, Object.fromEntries(cols.map((c, i) => [c, values[i]])));
    const keys = Object.keys(row);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

    try {
      await pool.query(sql, keys.map((k) => row[k]));
      count++;
    } catch (err) {
      if (!err.message.includes('duplicate') && !err.message.includes('unique')) {
        console.warn(`  ${table} row warning:`, err.message);
      }
    }
  }

  if (count > 0) {
    await pool.query(`
      SELECT setval(pg_get_serial_sequence('${table}', 'id'),
        COALESCE((SELECT MAX(id) FROM ${table}), 1), true)
    `).catch(() => {});
  }

  console.log(`  ${table}: ${count} rows`);
  return count;
}

async function migrateFiles(subdir, bucket) {
  const dir = path.join(UPLOADS, subdir);
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir);
  let count = 0;
  for (const filename of files) {
    const filePath = path.join(dir, filename);
    if (!fs.statSync(filePath).isFile()) continue;
    try {
      const buffer = fs.readFileSync(filePath);
      await storage.uploadFile(bucket, filename, buffer);
      count++;
    } catch (err) {
      console.warn(`  file ${filename}:`, err.message);
    }
  }
  console.log(`  ${bucket}: ${count} files uploaded`);
  return count;
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL missing in backend/.env');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in backend/.env');
    process.exit(1);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error('No local study.db found at', DB_PATH);
    process.exit(1);
  }

  console.log('StudyFlow → Supabase migration\n');

  const SQL = await initSqlJs();
  const sqliteDb = new SQL.Database(fs.readFileSync(DB_PATH));

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  await pool.query('SELECT 1');
  console.log('Connected to Supabase Postgres\n');

  console.log('Migrating tables...');
  for (const table of TABLES) {
    await migrateTable(pool, sqliteDb, table);
  }

  console.log('\nMigrating files to Supabase Storage...');
  await migrateFiles('notes', storage.BUCKETS.NOTES);
  await migrateFiles('past-papers', storage.BUCKETS.PAPERS);

  const units = (await pool.query('SELECT COUNT(*)::int AS c FROM units')).rows[0].c;
  const notes = (await pool.query('SELECT COUNT(*)::int AS c FROM notes')).rows[0].c;

  console.log('\n── Done ──');
  console.log(`Supabase now has ${units} units, ${notes} notes`);
  console.log('\nNext steps:');
  console.log('1. Restart server: node server.js');
  console.log('2. Test: http://localhost:3001/api/units');
  console.log('3. Check Supabase Table Editor → units, notes');
  console.log('4. Add same env vars on Render and redeploy');

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
