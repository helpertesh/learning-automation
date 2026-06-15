const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { days } = req.query;
  const limit = days ? Number(days) : 60;

  const logs = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM training_logs t
    LEFT JOIN units u ON t.unit_id = u.id
    ORDER BY t.log_date DESC, t.created_at DESC
    LIMIT ?
  `).all(limit);

  res.json(logs);
});

router.get('/today', async (_req, res) => {
  const log = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM training_logs t
    LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.log_date = date('now')
    ORDER BY t.created_at DESC
  `).all();
  res.json(log);
});

router.get('/streak', async (_req, res) => {
  const dates = (await db.prepare(`
    SELECT DISTINCT log_date FROM training_logs ORDER BY log_date DESC
  `).all()).map((r) => r.log_date);

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (dates[i] === expectedStr) streak++;
    else break;
  }

  res.json({ streak_days: streak, total_logs: dates.length });
});

router.post('/', async (req, res) => {
  const { unit_id, log_date, topic, learned, goals, cursor_notes, rating } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required' });

  const result = await db.prepare(`
    INSERT INTO training_logs (unit_id, log_date, topic, learned, goals, cursor_notes, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    unit_id || null,
    log_date || new Date().toISOString().slice(0, 10),
    topic.trim(),
    learned?.trim() || null,
    goals?.trim() || null,
    cursor_notes?.trim() || null,
    rating ?? 3,
  );

  const log = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM training_logs t LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(log);
});

router.put('/:id', async (req, res) => {
  const existing = await db.prepare('SELECT * FROM training_logs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Log not found' });

  const { unit_id, log_date, topic, learned, goals, cursor_notes, rating } = req.body;
  await db.prepare(`
    UPDATE training_logs
    SET unit_id = ?, log_date = ?, topic = ?, learned = ?, goals = ?, cursor_notes = ?, rating = ?
    WHERE id = ?
  `).run(
    unit_id ?? existing.unit_id,
    log_date || existing.log_date,
    topic?.trim() || existing.topic,
    learned?.trim() ?? existing.learned,
    goals?.trim() ?? existing.goals,
    cursor_notes?.trim() ?? existing.cursor_notes,
    rating ?? existing.rating,
    req.params.id,
  );

  const log = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM training_logs t LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json(log);
});

router.delete('/:id', async (req, res) => {
  const result = await db.prepare('DELETE FROM training_logs WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Log not found' });
  res.json({ success: true });
});

module.exports = router;
