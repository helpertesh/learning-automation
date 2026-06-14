const express = require('express');
const db = require('../db');
const { analyzeUnit } = require('../services/examAnalyzer');

const router = express.Router();

router.post('/analyze', async (req, res) => {
  try {
    const { unit_id, paper_id } = req.body;
    if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

    const result = await analyzeUnit(unit_id, paper_id || null);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:unitId/history', (req, res) => {
  const rows = db.prepare(`
    SELECT id, unit_id, paper_id, created_at FROM exam_analyses
    WHERE unit_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(req.params.unitId);

  res.json(rows);
});

router.get('/:unitId', (req, res) => {
  const unitId = req.params.unitId;

  const unit = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM topics WHERE unit_id = u.id) AS total_topics,
      (SELECT COUNT(*) FROM topics WHERE unit_id = u.id AND is_covered = 1) AS covered_topics,
      (SELECT COUNT(*) FROM notes WHERE unit_id = u.id) AS notes_count,
      (SELECT COUNT(*) FROM past_papers WHERE unit_id = u.id) AS papers_count
    FROM units u WHERE u.id = ?
  `).get(unitId);

  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  const latest = db.prepare(`
    SELECT * FROM exam_analyses WHERE unit_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(unitId);

  const analysis = latest ? JSON.parse(latest.analysis_json) : null;

  res.json({
    unit,
    coverage_percentage: unit.total_topics
      ? Math.round((unit.covered_topics / unit.total_topics) * 100)
      : 0,
    latest_analysis: analysis,
    latest_analysis_at: latest?.created_at || null,
  });
});

module.exports = router;
