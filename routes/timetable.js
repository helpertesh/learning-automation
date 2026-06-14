const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (_req, res) => {
  const slots = db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color, u.code AS unit_code
    FROM timetable_slots t
    LEFT JOIN units u ON t.unit_id = u.id
    ORDER BY t.day_of_week, t.start_time
  `).all();
  res.json(slots);
});

router.get('/today', (_req, res) => {
  const day = new Date().getDay();
  const slots = db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color, u.code AS unit_code
    FROM timetable_slots t
    LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.day_of_week = ?
    ORDER BY t.start_time
  `).all(day);
  res.json(slots);
});

router.post('/', (req, res) => {
  const { day_of_week, start_time, end_time, unit_id, label, location } = req.body;
  if (day_of_week === undefined || !start_time || !end_time) {
    return res.status(400).json({ error: 'day_of_week, start_time, and end_time are required' });
  }

  const result = db.prepare(`
    INSERT INTO timetable_slots (day_of_week, start_time, end_time, unit_id, label, location)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    day_of_week, start_time, end_time,
    unit_id || null, label?.trim() || null, location?.trim() || null
  );

  const slot = db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM timetable_slots t LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(slot);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM timetable_slots WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Slot not found' });

  const { day_of_week, start_time, end_time, unit_id, label, location } = req.body;
  db.prepare(`
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
    req.params.id
  );

  const slot = db.prepare(`
    SELECT t.*, u.name AS unit_name, u.color AS unit_color
    FROM timetable_slots t LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json(slot);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM timetable_slots WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Slot not found' });
  res.json({ success: true });
});

module.exports = router;
