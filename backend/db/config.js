/** Prefer SUPABASE_DATABASE_URL so Render's auto DATABASE_URL (linked Postgres) cannot override. */
function getPostgresUrl() {
  return (process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL)?.trim() || '';
}

function getPostgresUrlSource() {
  if (process.env.SUPABASE_DATABASE_URL?.trim()) return 'SUPABASE_DATABASE_URL';
  if (process.env.DATABASE_URL?.trim()) return 'DATABASE_URL';
  return null;
}

module.exports = { getPostgresUrl, getPostgresUrlSource };
