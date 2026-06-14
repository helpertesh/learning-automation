const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { uploadNotes } = require('../middleware/upload');
const { summarizeNote, getNoteSummary } = require('../services/noteAi');

const router = express.Router();
router.get('/', (req, res) => {
  const { unit_id } = req.query;
  let notes;
  if (unit_id) {
    notes = db.prepare(`
      SELECT n.*, u.name AS unit_name, u.color AS unit_color
      FROM notes n JOIN units u ON n.unit_id = u.id
      WHERE n.unit_id = ? ORDER BY n.created_at DESC
    `).all(unit_id);
  } else {
    notes = db.prepare(`
      SELECT n.*, u.name AS unit_name, u.color AS unit_color
      FROM notes n JOIN units u ON n.unit_id = u.id
      ORDER BY n.created_at DESC
    `).all();
  }
  res.json(notes);
});

router.post('/', uploadNotes.single('file'), (req, res) => {
  const { unit_id, title } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'Unit is required' });
  if (!req.file) return res.status(400).json({ error: 'File is required' });

  const unit = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  const noteTitle = title?.trim() || req.file.originalname;
  const result = db.prepare(`
    INSERT INTO notes (unit_id, title, filename, original_name, file_size)
    VALUES (?, ?, ?, ?, ?)
  `).run(unit_id, noteTitle, req.file.filename, req.file.originalname, req.file.size);

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(note);
});

router.post('/:id/summarize', async (req, res, next) => {
  try {
    const result = await summarizeNote(Number(req.params.id));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/summary', (req, res) => {
  const summary = getNoteSummary(Number(req.params.id));
  if (!summary) return res.status(404).json({ error: 'No summary yet. Click Create Summary first.' });
  res.json(summary);
});

router.get('/:id/quizzes', (req, res) => {
  const noteId = Number(req.params.id);
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const quizzes = db.prepare(`
    SELECT q.*,
      (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS question_count,
      (SELECT MAX(score) FROM quiz_attempts WHERE quiz_id = q.id) AS best_score,
      (SELECT MAX(total) FROM quiz_attempts WHERE quiz_id = q.id) AS total_questions
    FROM quizzes q WHERE q.note_id = ? ORDER BY q.created_at DESC
  `).all(noteId);

  res.json(quizzes);
});

router.get('/:id/download', (req, res) => {  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const filePath = path.join(__dirname, '..', 'uploads', 'notes', note.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, note.original_name);
});

router.delete('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const filePath = path.join(__dirname, '..', 'uploads', 'notes', note.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
