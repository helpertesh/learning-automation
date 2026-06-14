const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { unit_id } = req.query;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  const topics = db.prepare(`
    SELECT * FROM topics WHERE unit_id = ? ORDER BY sort_order, name
  `).all(unit_id);

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_covered = 1 THEN 1 ELSE 0 END) AS covered
    FROM topics WHERE unit_id = ?
  `).get(unit_id);

  res.json({ topics, stats });
});

router.post('/', (req, res) => {
  const { unit_id, name, sort_order } = req.body;
  if (!unit_id || !name?.trim()) {
    return res.status(400).json({ error: 'unit_id and name are required' });
  }

  const result = db.prepare(`
    INSERT INTO topics (unit_id, name, sort_order) VALUES (?, ?, ?)
  `).run(unit_id, name.trim(), sort_order ?? 0);

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(topic);
});

router.post('/bulk', (req, res) => {
  const { unit_id, topics } = req.body;
  if (!unit_id || !Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({ error: 'unit_id and topics array are required' });
  }

  const insert = db.prepare('INSERT INTO topics (unit_id, name, sort_order) VALUES (?, ?, ?)');
  const created = [];
  topics.forEach((name, i) => {
    if (!name?.trim()) return;
    const r = insert.run(unit_id, name.trim(), i);
    created.push(db.prepare('SELECT * FROM topics WHERE id = ?').get(r.lastInsertRowid));
  });

  res.status(201).json(created);
});

router.patch('/:id/cover', (req, res) => {
  const { is_covered } = req.body;
  const covered = is_covered ? 1 : 0;
  const coveredAt = is_covered ? new Date().toISOString() : null;

  const result = db.prepare(`
    UPDATE topics SET is_covered = ?, covered_at = ? WHERE id = ?
  `).run(covered, coveredAt, req.params.id);

  if (!result.changes) return res.status(404).json({ error: 'Topic not found' });
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);
  res.json(topic);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topic not found' });

  const { name, sort_order } = req.body;
  db.prepare('UPDATE topics SET name = ?, sort_order = ? WHERE id = ?').run(
    name?.trim() || existing.name,
    sort_order ?? existing.sort_order,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Topic not found' });
  res.json({ success: true });
});

module.exports = router;
