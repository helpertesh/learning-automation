const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'study.db');
let db;

function persist() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function prepare(sql) {
  return {
    run(...params) {
      db.run(sql, params);
      const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] ?? 0;
      const changes = db.getRowsModified();
      persist();
      return Promise.resolve({ lastInsertRowid: lastId, changes });
    },
    get(...params) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        if (stmt.step()) return Promise.resolve(stmt.getAsObject());
        return Promise.resolve(undefined);
      } finally {
        stmt.free();
      }
    },
    all(...params) {
      const results = [];
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        while (stmt.step()) results.push(stmt.getAsObject());
        return Promise.resolve(results);
      } finally {
        stmt.free();
      }
    },
  };
}

function exec(sql) {
  db.exec(sql);
  persist();
  return Promise.resolve();
}

async function init() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  exec(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS past_papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      year TEXT,
      semester TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      deadline TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      reminder_days INTEGER DEFAULT 3,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER,
      duration_minutes INTEGER NOT NULL,
      notes TEXT,
      studied_at TEXT DEFAULT (datetime('now')),
      topic_name TEXT,
      session_type TEXT DEFAULT 'manual',
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'deadline',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS training_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER,
      log_date TEXT NOT NULL DEFAULT (date('now')),
      topic TEXT NOT NULL,
      learned TEXT,
      goals TEXT,
      cursor_notes TEXT,
      rating INTEGER DEFAULT 3,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_covered INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      covered_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS timetable_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      unit_id INTEGER,
      label TEXT,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS exam_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      paper_id INTEGER,
      analysis_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
      FOREIGN KEY (paper_id) REFERENCES past_papers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS note_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL UNIQUE,
      summary_text TEXT NOT NULL,
      key_points_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT DEFAULT 'mcq',
      options_json TEXT,
      correct_answer TEXT NOT NULL,
      topic TEXT,
      sort_order INTEGER DEFAULT 0,
      source_paper TEXT,
      note_refs_json TEXT,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      score INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      weak_topics_json TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      user_answer TEXT,
      is_correct INTEGER DEFAULT 0,
      ai_feedback TEXT,
      score REAL DEFAULT 0,
      FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS topic_weakness (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      topic_name TEXT NOT NULL,
      weakness_score INTEGER DEFAULT 1,
      source TEXT DEFAULT 'quiz',
      last_assessed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
      UNIQUE(unit_id, topic_name)
    );
    CREATE TABLE IF NOT EXISTS whatsapp_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_key TEXT NOT NULL UNIQUE,
      message_preview TEXT,
      sent_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_it_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL UNIQUE,
      level TEXT DEFAULT 'intermediate',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS paper_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      topic TEXT,
      solution_text TEXT,
      note_refs_json TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (paper_id) REFERENCES past_papers(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS daily_it_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_date TEXT NOT NULL,
      skill_category TEXT NOT NULL,
      title TEXT NOT NULL,
      overview TEXT,
      key_concepts_json TEXT,
      practical_task TEXT,
      resources_json TEXT,
      reflection TEXT,
      completed INTEGER DEFAULT 0,
      duration_minutes INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(lesson_date)
    );
  `);

  const count = db.exec('SELECT COUNT(*) FROM user_it_skills')[0]?.values[0]?.[0] || 0;
  if (count === 0) {
    exec("INSERT INTO user_it_skills (skill_name, level) VALUES ('Website Design', 'intermediate')");
  }

  console.log('Database: local SQLite (backend/data/study.db)');
}

function getEngine() {
  return 'sqlite';
}

module.exports = { init, prepare, exec, getEngine };
