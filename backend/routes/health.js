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
    const storageHealth = await storage.getStorageHealth();

    res.json({
      ok: true,
      engine,
      storage: storageHealth,
      counts: { units, notes, timetable_slots: timetable },
      message: engine === 'postgres'
        ? 'Using Supabase Postgres — data persists in the cloud'
        : 'Using local SQLite — add DATABASE_URL for Supabase',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/storage', async (_req, res, next) => {
  try {
    const storageHealth = await storage.getStorageHealth();
    res.status(storageHealth.ok ? 200 : 503).json(storageHealth);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
