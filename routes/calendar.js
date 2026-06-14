const express = require('express');
const db = require('../db');
const { generateDeadlineNotifications } = require('../services/notifications');

const router = express.Router();

router.get('/', (req, res) => {
  const { month } = req.query;
  generateDeadlineNotifications();

  let start, end;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    end = `${month}-${String(lastDay).padStart(2, '0')}`;
  } else {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    start = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  }

  const assignments = db.prepare(`
    SELECT a.*, u.name AS unit_name, u.color AS unit_color
    FROM assignments a JOIN units u ON a.unit_id = u.id
    WHERE date(a.deadline) BETWEEN ? AND ?
    ORDER BY a.deadline ASC
  `).all(start, end);

  const studySessions = db.prepare(`
    SELECT date(studied_at) AS day, SUM(duration_minutes) AS minutes
    FROM study_sessions
    WHERE date(studied_at) BETWEEN ? AND ?
    GROUP BY date(studied_at)
  `).all(start, end);

  const trainingDays = db.prepare(`
    SELECT DISTINCT log_date AS day FROM training_logs
    WHERE log_date BETWEEN ? AND ?
  `).all(start, end);

  res.json({ month: start.slice(0, 7), assignments, studySessions, trainingDays });
});

module.exports = router;
