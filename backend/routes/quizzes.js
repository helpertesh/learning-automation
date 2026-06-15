const express = require('express');
const db = require('../db');
const { generateQuiz, getQuiz, markQuiz } = require('../services/noteAi');

const router = express.Router();

router.get('/', async (req, res) => {
  const { unit_id, note_id } = req.query;
  let quizzes;

  if (note_id) {
    quizzes = await db.prepare(`
      SELECT q.*, n.title AS note_title, u.name AS unit_name, u.color AS unit_color,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS question_count
      FROM quizzes q
      JOIN notes n ON q.note_id = n.id
      JOIN units u ON q.unit_id = u.id
      WHERE q.note_id = ? ORDER BY q.created_at DESC
    `).all(note_id);
  } else if (unit_id) {
    quizzes = await db.prepare(`
      SELECT q.*, n.title AS note_title, u.name AS unit_name, u.color AS unit_color,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS question_count
      FROM quizzes q
      JOIN notes n ON q.note_id = n.id
      JOIN units u ON q.unit_id = u.id
      WHERE q.unit_id = ? ORDER BY q.created_at DESC
    `).all(unit_id);
  } else {
    quizzes = await db.prepare(`
      SELECT q.*, n.title AS note_title, u.name AS unit_name, u.color AS unit_color,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS question_count
      FROM quizzes q
      JOIN notes n ON q.note_id = n.id
      JOIN units u ON q.unit_id = u.id
      ORDER BY q.created_at DESC LIMIT 50
    `).all();
  }

  res.json(quizzes);
});

router.post('/generate', async (req, res, next) => {
  try {
    const { note_id } = req.body;
    if (!note_id) return res.status(400).json({ error: 'note_id is required' });
    const quiz = await generateQuiz(Number(note_id));
    res.status(201).json(quiz);
  } catch (err) {
    next(err);
  }
});

router.get('/weak-topics', async (req, res) => {
  const { unit_id } = req.query;
  let topics;
  if (unit_id) {
    topics = await db.prepare(`
      SELECT tw.*, u.name AS unit_name, u.color AS unit_color
      FROM topic_weakness tw JOIN units u ON tw.unit_id = u.id
      WHERE tw.unit_id = ? ORDER BY tw.weakness_score DESC
    `).all(unit_id);
  } else {
    topics = await db.prepare(`
      SELECT tw.*, u.name AS unit_name, u.color AS unit_color
      FROM topic_weakness tw JOIN units u ON tw.unit_id = u.id
      ORDER BY tw.weakness_score DESC LIMIT 20
    `).all();
  }
  res.json(topics);
});

router.get('/:id', async (req, res) => {
  const quiz = await getQuiz(Number(req.params.id));
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  res.json(quiz);
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    const { answers } = req.body;
    if (!answers?.length) return res.status(400).json({ error: 'answers array is required' });
    const result = await markQuiz(Number(req.params.id), answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/attempts', async (req, res) => {
  const attempts = await db.prepare(`
    SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY completed_at DESC
  `).all(Number(req.params.id));
  res.json(attempts.map((a) => ({
    ...a,
    weak_topics: a.weak_topics_json ? JSON.parse(a.weak_topics_json) : [],
  })));
});

module.exports = router;
