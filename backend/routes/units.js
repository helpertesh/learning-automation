const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const units = await db.prepare(`
      SELECT u.*,
        (SELECT COUNT(*) FROM notes WHERE unit_id = u.id) AS notes_count,
        (SELECT COUNT(*) FROM past_papers WHERE unit_id = u.id) AS papers_count,
        (SELECT COUNT(*) FROM assignments WHERE unit_id = u.id AND status != 'completed') AS assignments_count
      FROM units u
      ORDER BY u.name
    `).all();
    res.json(units);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, code, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const result = await db.prepare(
      'INSERT INTO units (name, code, description, color) VALUES (?, ?, ?, ?)',
    ).run(name.trim(), code?.trim() || null, description?.trim() || null, color || '#6366f1');

    const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(unit);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, code, description, color } = req.body;
    const existing = await db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Unit not found' });

    await db.prepare(
      'UPDATE units SET name = ?, code = ?, description = ?, color = ? WHERE id = ?',
    ).run(
      name?.trim() || existing.name,
      code?.trim() ?? existing.code,
      description?.trim() ?? existing.description,
      color || existing.color,
      req.params.id,
    );

    const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
    res.json(unit);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Unit not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
