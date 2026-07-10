const express = require('express');
const path = require('path');
const db = require('../db');
const { uploadNotes } = require('../middleware/upload');
const storage = require('../services/storage');
const { summarizeNote, getNoteSummary, getNotePageExcerpt } = require('../services/noteAi');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { unit_id } = req.query;
    let notes;
    if (unit_id) {
      notes = await db.prepare(`
        SELECT n.*, u.name AS unit_name, u.color AS unit_color
        FROM notes n JOIN units u ON n.unit_id = u.id
        WHERE n.unit_id = ? ORDER BY n.created_at DESC
      `).all(unit_id);
    } else {
      notes = await db.prepare(`
        SELECT n.*, u.name AS unit_name, u.color AS unit_color
        FROM notes n JOIN units u ON n.unit_id = u.id
        ORDER BY n.created_at DESC
      `).all();
    }
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

router.post('/', uploadNotes.single('file'), async (req, res, next) => {
  try {
    const { unit_id, title } = req.body;
    if (!unit_id) return res.status(400).json({ error: 'Unit is required' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const unit = await db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    const ext = path.extname(req.file.originalname);
    const filename = req.file.filename || `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const buffer = req.file.buffer || require('fs').readFileSync(req.file.path);

    await storage.uploadFile(storage.BUCKETS.NOTES, filename, buffer, req.file.mimetype);

    const noteTitle = title?.trim() || req.file.originalname;
    const result = await db.prepare(`
      INSERT INTO notes (unit_id, title, filename, original_name, file_size)
      VALUES (?, ?, ?, ?, ?)
    `).run(unit_id, noteTitle, filename, req.file.originalname, req.file.size);

    const note = await db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/summarize', async (req, res, next) => {
  try {
    const result = await summarizeNote(Number(req.params.id));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/summary', async (req, res, next) => {
  try {
    const summary = await getNoteSummary(Number(req.params.id));
    if (!summary) return res.status(404).json({ error: 'No summary yet. Click Create Summary first.' });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/quizzes', async (req, res, next) => {
  try {
    const noteId = Number(req.params.id);
    const note = await db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const quizzes = await db.prepare(`
      SELECT q.*,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS question_count,
        (SELECT MAX(score) FROM quiz_attempts WHERE quiz_id = q.id) AS best_score,
        (SELECT MAX(total) FROM quiz_attempts WHERE quiz_id = q.id) AS total_questions
      FROM quizzes q WHERE q.note_id = ? ORDER BY q.created_at DESC
    `).all(noteId);

    res.json(quizzes);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/pages', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const result = await getNotePageExcerpt(Number(req.params.id), {
      from: from ? Number(from) : 1,
      to: to ? Number(to) : null,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const note = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const buffer = await storage.downloadBuffer(storage.BUCKETS.NOTES, note.filename);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(note.original_name)}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const note = await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    await storage.deleteFile(storage.BUCKETS.NOTES, note.filename);
    await db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
