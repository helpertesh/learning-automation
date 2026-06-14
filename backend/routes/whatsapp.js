const express = require('express');
const { getStatus, sendNotification, isAnyConfigured } = require('../services/messaging');
const { buildDailyDigest, sendDailyDigest } = require('../services/studyDigest');
const { processWhatsAppAlerts } = require('../services/notifications');
const router = express.Router();

router.get('/status', (_req, res) => {
  res.json(getStatus());
});

router.post('/test', async (req, res, next) => {
  try {
    if (!isAnyConfigured()) {
      return res.status(400).json({
        error: 'No messaging channel configured. Set up Telegram (recommended) or WhatsApp in backend/.env — see .env.example',
      });
    }
    const result = await sendNotification(
      '✅ *StudyFlow connected!*\n\nYou will receive assignment alerts, quiz results, and daily study updates here.',
      { messageKey: `test:${Date.now()}`, skipDedup: true },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/digest', async (req, res, next) => {
  try {
    if (!isAnyConfigured()) {
      return res.status(400).json({ error: 'No messaging channel configured' });
    }
    const result = await sendDailyDigest();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/digest/preview', (_req, res) => {
  res.json({ text: buildDailyDigest() });
});

router.post('/sync-alerts', async (_req, res, next) => {
  try {
    const results = await processWhatsAppAlerts();
    res.json({ processed: results.length, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
