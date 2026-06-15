const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  const slots = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color, u.code AS unit_code
    FROM timetable_slots t
    LEFT JOIN units u ON t.unit_id = u.id
    ORDER BY t.day_of_week, t.start_time
  `).all();
  res.json(slots);
});

router.get('/today', async (_req, res) => {
  const day = new Date().getDay();
  const slots = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color, u.code AS unit_code
    FROM timetable_slots t
    LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.day_of_week = ?
    ORDER BY t.start_time
  `).all(day);
  res.json(slots);
});

router.post('/', async (req, res) => {
  const { day_of_week, start_time, end_time, unit_id, label, location } = req.body;
  if (day_of_week === undefined || !start_time || !end_time) {
    return res.status(400).json({ error: 'day_of_week, start_time, and end_time are required' });
  }

  const result = await db.prepare(`
    INSERT INTO timetable_slots (day_of_week, start_time, end_time, unit_id, label, location)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    day_of_week, start_time, end_time,
    unit_id || null, label?.trim() || null, location?.trim() || null,
  );

  const slot = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM timetable_slots t LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(slot);
});

router.put('/:id', async (req, res) => {
  const existing = await db.prepare('SELECT * FROM timetable_slots WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Slot not found' });

  const { day_of_week, start_time, end_time, unit_id, label, location } = req.body;
  await db.prepare(`
    UPDATE timetable_slots
    SET day_of_week = ?, start_time = ?, end_time = ?, unit_id = ?, label = ?, location = ?
    WHERE id = ?
  `).run(
    day_of_week ?? existing.day_of_week,
    start_time || existing.start_time,
    end_time || existing.end_time,
    unit_id !== undefined ? (unit_id || null) : existing.unit_id,
    label?.trim() ?? existing.label,
    location?.trim() ?? existing.location,
    req.params.id,
  );

  const slot = await db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM timetable_slots t LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json(slot);
});

router.delete('/:id', async (req, res) => {
  const result = await db.prepare('DELETE FROM timetable_slots WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Slot not found' });
  res.json({ success: true });
});

module.exports = router;
