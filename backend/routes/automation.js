const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/weak-topics', async (_req, res) => {
  const topics = await db.prepare(`
    SELECT tw.*, u.name AS unit_name, u.color AS unit_color
    FROM topic_weakness tw JOIN units u ON tw.unit_id = u.id
    ORDER BY tw.weakness_score DESC
  `).all();
  res.json(topics);
});

router.get('/quiz-progress', async (_req, res) => {
  const stats = {
    total_quizzes: (await db.prepare('SELECT COUNT(*) AS c FROM quizzes').get()).c,
    total_attempts: (await db.prepare('SELECT COUNT(*) AS c FROM quiz_attempts WHERE completed_at IS NOT NULL').get()).c,
    avg_score: (await db.prepare(`
      SELECT ROUND(AVG(CAST(score AS REAL) / NULLIF(total, 0)) * 100) AS avg
      FROM quiz_attempts WHERE completed_at IS NOT NULL AND total > 0
    `).get()).avg || 0,
    summaries_created: (await db.prepare('SELECT COUNT(*) AS c FROM note_summaries').get()).c,
  };

  const recentAttempts = (await db.prepare(`
    SELECT a.*, q.title AS quiz_title, n.title AS note_title, u.name AS unit_name
    FROM quiz_attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    JOIN notes n ON q.note_id = n.id
    JOIN units u ON q.unit_id = u.id
    WHERE a.completed_at IS NOT NULL
    ORDER BY a.completed_at DESC LIMIT 5
  `).all()).map((a) => ({
    ...a,
    percentage: a.total ? Math.round((a.score / a.total) * 100) : 0,
    weak_topics: a.weak_topics_json ? JSON.parse(a.weak_topics_json) : [],
  }));

  res.json({ stats, recentAttempts });
});

module.exports = router;
