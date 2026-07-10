const express = require('express');
const path = require('path');
const db = require('../db');
const { uploadPastPapers } = require('../middleware/upload');
const storage = require('../services/storage');
const {
  analyzePaperForRevision,
  getPaperQuestions,
  createQuizFromPaper,
} = require('../services/paperRevision');

const router = express.Router();

router.get('/', async (req, res) => {
  const { unit_id } = req.query;
  let papers;
  if (unit_id) {
    papers = await db.prepare(`
      SELECT p.*, u.name AS unit_name, u.color AS unit_color,
        (SELECT COUNT(*) FROM paper_questions WHERE paper_id = p.id) AS question_count
      FROM past_papers p JOIN units u ON p.unit_id = u.id
      WHERE p.unit_id = ? ORDER BY p.year DESC, p.created_at DESC
    `).all(unit_id);
  } else {
    papers = await db.prepare(`
      SELECT p.*, u.name AS unit_name, u.color AS unit_color,
        (SELECT COUNT(*) FROM paper_questions WHERE paper_id = p.id) AS question_count
      FROM past_papers p JOIN units u ON p.unit_id = u.id
      ORDER BY p.year DESC, p.created_at DESC
    `).all();
  }
  res.json(papers);
});

router.post('/', uploadPastPapers.single('file'), async (req, res, next) => {
  try {
    const { unit_id, title, year, semester, note_ids } = req.body;
    if (!unit_id) return res.status(400).json({ error: 'Unit is required' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const unit = await db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    const ext = path.extname(req.file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    await storage.uploadFile(storage.BUCKETS.PAPERS, filename, req.file.buffer, req.file.mimetype);

    const paperTitle = title?.trim() || req.file.originalname;
    const result = await db.prepare(`
      INSERT INTO past_papers (unit_id, title, year, semester, filename, original_name, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      unit_id, paperTitle, year?.trim() || null, semester?.trim() || null,
      filename, req.file.originalname, req.file.size,
    );

    const paper = await db.prepare('SELECT * FROM past_papers WHERE id = ?').get(result.lastInsertRowid);

    let revision = null;
    const parsedNoteIds = parseNoteIds(note_ids);
    if (parsedNoteIds.length > 0) {
      try {
        revision = await analyzePaperForRevision(paper.id, { noteIds: parsedNoteIds });
      } catch (err) {
        revision = { error: err.message };
      }
    }

    res.status(201).json({ ...paper, revision });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/analyze', async (req, res, next) => {
  try {
    const paperId = Number(req.params.id);
    const noteIds = Array.isArray(req.body.note_ids)
      ? req.body.note_ids.map(Number).filter((id) => Number.isFinite(id) && id > 0)
      : parseNoteIds(req.body.note_ids);

    const result = await analyzePaperForRevision(paperId, { noteIds: noteIds.length ? noteIds : null });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/questions', async (req, res, next) => {
  try {
    const data = await getPaperQuestions(Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Past paper not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/create-quiz', async (req, res, next) => {
  try {
    const quiz = await createQuizFromPaper(Number(req.params.id));
    res.status(201).json(quiz);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const paper = await db.prepare('SELECT * FROM past_papers WHERE id = ?').get(req.params.id);
    if (!paper) return res.status(404).json({ error: 'Past paper not found' });

    const buffer = await storage.downloadBuffer(storage.BUCKETS.PAPERS, paper.filename);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(paper.original_name)}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const paper = await db.prepare('SELECT * FROM past_papers WHERE id = ?').get(req.params.id);
    if (!paper) return res.status(404).json({ error: 'Past paper not found' });

    await storage.deleteFile(storage.BUCKETS.PAPERS, paper.filename);
    await db.prepare('DELETE FROM past_papers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

function parseNoteIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter((id) => Number.isFinite(id) && id > 0);
    }
  } catch {
    // fall through
  }
  return String(raw).split(',').map(Number).filter((id) => Number.isFinite(id) && id > 0);
}

module.exports = router;
