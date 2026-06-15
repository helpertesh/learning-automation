const db = require('../db');

function daysUntil(deadline) {
  const now = new Date();
  const due = new Date(deadline);
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

async function generateDeadlineNotifications() {
  const assignments = await db.prepare(`
    SELECT a.*, u.name AS unit_name
    FROM assignments a JOIN units u ON a.unit_id = u.id
    WHERE a.status != 'completed'
  `).all();

  const insert = db.prepare(`
    INSERT INTO notifications (assignment_id, message, type)
    SELECT ?, ?, 'deadline'
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE assignment_id = ? AND message = ? AND date(created_at) = date('now')
    )
  `);

  const newNotifications = [];

  for (const a of assignments) {
    const days = daysUntil(a.deadline);
    let message = null;

    if (days < 0) {
      message = `OVERDUE: "${a.title}" (${a.unit_name}) was due ${Math.abs(days)} day(s) ago`;
    } else if (days === 0) {
      message = `DUE TODAY: "${a.title}" for ${a.unit_name}`;
    } else if (days <= a.reminder_days) {
      message = `Due in ${days} day(s): "${a.title}" for ${a.unit_name}`;
    }

    if (!message) continue;

    const result = await insert.run(a.id, message, a.id, message);
    if (result.changes) {
      newNotifications.push({ id: result.lastInsertRowid, message });
    }
  }

  return newNotifications;
}

async function processWhatsAppAlerts() {
  const { sendAlert } = require('./studyDigest');
  const newOnes = await generateDeadlineNotifications();
  const results = [];

  for (const n of newOnes) {
    try {
      const r = await sendAlert(n.message, n.id);
      results.push({ notification_id: n.id, ...r });
    } catch (err) {
      console.warn('WhatsApp alert failed:', err.message);
      results.push({ notification_id: n.id, sent: false, error: err.message });
    }
  }

  return results;
}

module.exports = { generateDeadlineNotifications, processWhatsAppAlerts };
