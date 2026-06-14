const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { uploadPastPapers } = require('../middleware/upload');

const router = express.Router();

router.get('/', (req, res) => {
  const { unit_id } = req.query;
  let papers;
  if (unit_id) {
    papers = db.prepare(`
      SELECT p.*, u.name AS unit_name, u.color AS unit_color
      FROM past_papers p JOIN units u ON p.unit_id = u.id
      WHERE p.unit_id = ? ORDER BY p.year DESC, p.created_at DESC
    `).all(unit_id);
  } else {
    papers = db.prepare(`
      SELECT p.*, u.name AS unit_name, u.color AS unit_color
      FROM past_papers p JOIN units u ON p.unit_id = u.id
      ORDER BY p.year DESC, p.created_at DESC
    `).all();
  }
  res.json(papers);
});

router.post('/', uploadPastPapers.single('file'), (req, res) => {
  const { unit_id, title, year, semester } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'Unit is required' });
  if (!req.file) return res.status(400).json({ error: 'File is required' });

  const unit = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  const paperTitle = title?.trim() || req.file.originalname;
  const result = db.prepare(`
    INSERT INTO past_papers (unit_id, title, year, semester, filename, original_name, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    unit_id, paperTitle, year?.trim() || null, semester?.trim() || null,
    req.file.filename, req.file.originalname, req.file.size
  );

  const paper = db.prepare('SELECT * FROM past_papers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(paper);
});

router.get('/:id/download', (req, res) => {
  const paper = db.prepare('SELECT * FROM past_papers WHERE id = ?').get(req.params.id);
  if (!paper) return res.status(404).json({ error: 'Past paper not found' });

  const filePath = path.join(__dirname, '..', 'uploads', 'past-papers', paper.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, paper.original_name);
});

router.delete('/:id', (req, res) => {
  const paper = db.prepare('SELECT * FROM past_papers WHERE id = ?').get(req.params.id);
  if (!paper) return res.status(404).json({ error: 'Past paper not found' });

  const filePath = path.join(__dirname, '..', 'uploads', 'past-papers', paper.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM past_papers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
