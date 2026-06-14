const express = require('express');
const { getAIConfig, isAIConfigured, testConnection } = require('../services/openai');

const router = express.Router();

router.get('/status', (_req, res) => {
  const { model, provider, baseUrl, apiKey } = getAIConfig();
  res.json({
    configured: isAIConfigured(),
    model,
    provider,
    baseUrl,
    key_preview: apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : null,
    features: {
      note_summaries: isAIConfigured(),
      quiz_generation: isAIConfigured(),
      quiz_marking: isAIConfigured(),
      exam_prep: isAIConfigured(),
    },
  });
});

router.post('/test', async (_req, res, next) => {
  try {
    const result = await testConnection();
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
