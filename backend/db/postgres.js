const { Pool } = require('pg');
const { getPostgresUrl, getPostgresUrlSource } = require('./config');

let pool;

function translateSql(sql) {
  let s = sql;
  s = s.replace(/datetime\('now'\)/gi, 'NOW()');
  s = s.replace(/datetime\('now',\s*'-(\d+) days'\)/gi, "(NOW() - INTERVAL '$1 days')");
  s = s.replace(/datetime\('now',\s*'-' \|\| \? \|\| ' days'\)/gi, "(NOW() - (? || ' days')::interval)");
  s = s.replace(/date\('now'\)/gi, 'CURRENT_DATE');
  s = s.replace(/date\('now',\s*'-(\d+) days'\)/gi, "(CURRENT_DATE - INTERVAL '$1 days')");
  s = s.replace(/date\(([^)]+)\)/gi, '($1::date)');

  const boolFields = ['is_read', 'is_covered', 'completed', 'is_correct'];
  for (const field of boolFields) {
    s = s.replace(new RegExp(`(WHERE|AND|OR)\\s+${field}\\s*=\\s*0\\b`, 'gi'), `$1 ${field} = false`);
    s = s.replace(new RegExp(`(WHERE|AND|OR)\\s+${field}\\s*=\\s*1\\b`, 'gi'), `$1 ${field} = true`);
    s = s.replace(new RegExp(`WHEN\\s+${field}\\s*=\\s*1\\b`, 'gi'), `WHEN ${field} = true`);
    s = s.replace(new RegExp(`WHEN\\s+${field}\\s*=\\s*0\\b`, 'gi'), `WHEN ${field} = false`);
  }

  let i = 0;
  s = s.replace(/\?/g, () => `$${++i}`);
  return s;
}

function prepare(sql) {
  const baseSql = translateSql(sql);

  return {
    async run(...params) {
      let q = baseSql.trim();
      const isInsert = /^INSERT/i.test(q);
      if (isInsert && !/RETURNING/i.test(q)) {
        q += ' RETURNING id';
      }
      const result = await pool.query(q, params);
      return {
        lastInsertRowid: result.rows[0]?.id ?? 0,
        changes: result.rowCount ?? 0,
      };
    },
    async get(...params) {
      const result = await pool.query(baseSql, params);
      return result.rows[0];
    },
    async all(...params) {
      const result = await pool.query(baseSql, params);
      return result.rows;
    },
  };
}

async function exec(sql) {
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(translateSql(stmt));
  }
}

function describeConnection(url) {
  try {
    const u = new URL(url);
    const user = decodeURIComponent(u.username || '');
    const host = u.hostname;
    const port = u.port || '5432';
    const pooler = host.includes('pooler.supabase.com');
    const hints = [];
    if (pooler && user === 'postgres') {
      hints.push('pooler host requires username postgres.[project-ref], not just "postgres"');
    }
    if (u.password === '[YOUR-PASSWORD]' || !u.password) {
      hints.push('replace [YOUR-PASSWORD] with your Supabase database password');
    }
    return { user, host, port, pooler, hints };
  } catch {
    return { user: '?', host: '?', port: '?', pooler: false, hints: ['DATABASE_URL is not a valid postgresql:// URI'] };
  }
}

async function init() {
  const url = getPostgresUrl();
  if (!url) throw new Error('SUPABASE_DATABASE_URL or DATABASE_URL is required for Postgres');

  const info = describeConnection(url);
  const source = getPostgresUrlSource();
  pool = new Pool({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query('SELECT 1');
  } catch (err) {
    if (err.code === '28P01') {
      const hint = info.hints.length
        ? info.hints.join('; ')
        : 'reset the database password in Supabase → Settings → Database, then update DATABASE_URL on Render';
      throw new Error(
        `Postgres login failed for user "${info.user}" @ ${info.host}:${info.port}. ${hint}`
      );
    }
    throw err;
  }
  console.log(`Database: Supabase Postgres connected (${info.host}:${info.port}, via ${source})`);
}

function getEngine() {
  return 'postgres';
}

module.exports = { init, prepare, exec, getEngine };
