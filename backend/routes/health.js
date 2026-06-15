const express = require('express');
const db = require('../db');
const storage = require('../services/storage');

const router = express.Router();

router.get('/db', async (_req, res, next) => {
  try {
    const engine = db.getEngine();
    const units = (await db.prepare('SELECT COUNT(*) AS count FROM units').get()).count;
    const notes = (await db.prepare('SELECT COUNT(*) AS count FROM notes').get()).count;
    const timetable = (await db.prepare('SELECT COUNT(*) AS count FROM timetable_slots').get()).count;

    res.json({
      ok: true,
      engine,
      storage: storage.isCloud() ? 'supabase' : 'local',
      counts: { units, notes, timetable_slots: timetable },
      message: engine === 'postgres'
        ? 'Using Supabase Postgres — data persists in the cloud'
        : 'Using local SQLite — add DATABASE_URL for Supabase',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
