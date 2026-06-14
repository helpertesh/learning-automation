const express = require('express');
const {
  getCategories,
  getUserSkills,
  saveUserSkills,
  getTodayLesson,
  getRecentLessons,
  generateLesson,
  completeLesson,
  getStreak,
} = require('../services/skillLearning');
const { isAIConfigured } = require('../services/openai');

const router = express.Router();

router.get('/categories', (_req, res) => {
  res.json(getCategories());
});

router.get('/skills', (_req, res) => {
  res.json(getUserSkills());
});

router.put('/skills', (req, res) => {
  const { skills } = req.body;
  if (!Array.isArray(skills)) {
    return res.status(400).json({ error: 'skills must be an array' });
  }
  res.json(saveUserSkills(skills));
});

router.get('/today', (_req, res) => {
  res.json(getTodayLesson());
});

router.get('/history', (req, res) => {
  const limit = Number(req.query.limit) || 30;
  res.json(getRecentLessons(limit));
});

router.get('/streak', (_req, res) => {
  res.json(getStreak());
});

router.post('/generate', async (req, res, next) => {
  try {
    const { category, regenerate } = req.body || {};
    const lesson = await generateLesson({ category, forceRegenerate: !!regenerate });
    res.json({ lesson, ai_enabled: isAIConfigured() });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/complete', (req, res) => {
  const lesson = completeLesson(Number(req.params.id), req.body);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  res.json(lesson);
});

module.exports = router;
