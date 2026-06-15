const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { days = 30 } = req.query;
  const sessions = await db.prepare(`
    SELECT s.*, u.name AS unit_name, u.color AS unit_color
    FROM study_sessions s
    LEFT JOIN units u ON s.unit_id = u.id
    WHERE s.studied_at >= datetime('now', '-' || ? || ' days')
    ORDER BY s.studied_at DESC
  `).all(days);
  res.json(sessions);
});

router.get('/stats', async (_req, res) => {
  const today = await db.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) AS minutes
    FROM study_sessions WHERE date(studied_at) = date('now')
  `).get();

  const week = await db.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) AS minutes
    FROM study_sessions WHERE studied_at >= datetime('now', '-7 days')
  `).get();

  const streak = await db.prepare(`
    SELECT date(studied_at) AS day FROM study_sessions
    GROUP BY date(studied_at) ORDER BY day DESC
  `).all();

  let streakCount = 0;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < streak.length; i++) {
    const expected = new Date(todayDate);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];
    if (streak[i].day === expectedStr) streakCount++;
    else break;
  }

  const daily = await db.prepare(`
    SELECT date(studied_at) AS day, SUM(duration_minutes) AS minutes
    FROM study_sessions
    WHERE studied_at >= datetime('now', '-7 days')
    GROUP BY date(studied_at) ORDER BY day ASC
  `).all();

  res.json({
    today_minutes: today.minutes,
    week_minutes: week.minutes,
    streak_days: streakCount,
    daily_chart: daily,
  });
});

router.post('/', async (req, res) => {
  const { unit_id, duration_minutes, notes } = req.body;
  if (!duration_minutes || duration_minutes < 1) {
    return res.status(400).json({ error: 'Duration must be at least 1 minute' });
  }

  const result = await db.prepare(`
    INSERT INTO study_sessions (unit_id, duration_minutes, notes) VALUES (?, ?, ?)
  `).run(unit_id || null, duration_minutes, notes?.trim() || null);

  const session = await db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

router.delete('/:id', async (req, res) => {
  const result = await db.prepare('DELETE FROM study_sessions WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Session not found' });
  res.json({ success: true });
});

module.exports = router;
