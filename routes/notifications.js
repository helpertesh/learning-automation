const express = require('express');
const db = require('../db');
const { generateDeadlineNotifications, processWhatsAppAlerts } = require('../services/notifications');

const router = express.Router();

router.get('/', (_req, res) => {
  generateDeadlineNotifications();
  processWhatsAppAlerts().catch(() => {});

  const notifications = db.prepare(`
    SELECT n.*, a.title AS assignment_title, a.deadline, u.name AS unit_name
    FROM notifications n
    JOIN assignments a ON n.assignment_id = a.id
    JOIN units u ON a.unit_id = u.id
    ORDER BY n.is_read ASC, n.created_at DESC
  `).all();
  res.json(notifications);
});

router.get('/unread-count', (_req, res) => {
  generateDeadlineNotifications();
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0').get();
  res.json({ count });
});

router.patch('/:id/read', (req, res) => {
  const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Notification not found' });
  res.json({ success: true });
});

router.patch('/read-all', (_req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ success: true });
});

module.exports = router;
