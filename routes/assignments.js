const express = require('express');
const db = require('../db');
const { generateDeadlineNotifications } = require('../services/notifications');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, unit_id } = req.query;
  let query = `
    SELECT a.*, u.name AS unit_name, u.color AS unit_color
    FROM assignments a JOIN units u ON a.unit_id = u.id WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND a.status = ?'; params.push(status); }
  if (unit_id) { query += ' AND a.unit_id = ?'; params.push(unit_id); }
  query += ' ORDER BY a.deadline ASC';

  res.json(db.prepare(query).all(...params));
});

router.get('/upcoming', (_req, res) => {
  generateDeadlineNotifications();
  const upcoming = db.prepare(`
    SELECT a.*, u.name AS unit_name, u.color AS unit_color
    FROM assignments a JOIN units u ON a.unit_id = u.id
    WHERE a.status != 'completed' AND a.deadline >= datetime('now')
    ORDER BY a.deadline ASC LIMIT 10
  `).all();
  res.json(upcoming);
});

router.post('/', (req, res) => {
  const { unit_id, title, description, deadline, priority, reminder_days } = req.body;
  if (!unit_id || !title?.trim() || !deadline) {
    return res.status(400).json({ error: 'Unit, title, and deadline are required' });
  }

  const unit = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  const result = db.prepare(`
    INSERT INTO assignments (unit_id, title, description, deadline, priority, reminder_days)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    unit_id, title.trim(), description?.trim() || null, deadline,
    priority || 'medium', reminder_days ?? 3
  );

  generateDeadlineNotifications();
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(assignment);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Assignment not found' });

  const { title, description, deadline, priority, status, reminder_days } = req.body;
  db.prepare(`
    UPDATE assignments SET title = ?, description = ?, deadline = ?, priority = ?, status = ?, reminder_days = ?
    WHERE id = ?
  `).run(
    title?.trim() || existing.title,
    description?.trim() ?? existing.description,
    deadline || existing.deadline,
    priority || existing.priority,
    status || existing.status,
    reminder_days ?? existing.reminder_days,
    req.params.id
  );

  generateDeadlineNotifications();
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  res.json(assignment);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Assignment not found' });
  res.json({ success: true });
});

module.exports = router;
