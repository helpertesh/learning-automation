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

router.get('/skills', async (_req, res, next) => {
  try {
    res.json(await getUserSkills());
  } catch (err) {
    next(err);
  }
});

router.put('/skills', async (req, res, next) => {
  try {
    const { skills } = req.body;
    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'skills must be an array' });
    }
    res.json(await saveUserSkills(skills));
  } catch (err) {
    next(err);
  }
});

router.get('/today', async (_req, res, next) => {
  try {
    res.json(await getTodayLesson());
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 30;
    res.json(await getRecentLessons(limit));
  } catch (err) {
    next(err);
  }
});

router.get('/streak', async (_req, res, next) => {
  try {
    res.json(await getStreak());
  } catch (err) {
    next(err);
  }
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

router.patch('/:id/complete', async (req, res, next) => {
  try {
    const lesson = await completeLesson(Number(req.params.id), req.body);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
