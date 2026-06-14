const db = require('../db');
const { sendNotification } = require('./messaging');

function formatMinutes(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function buildDailyDigest() {
  const lines = ['📚 *StudyFlow Daily Update*', ''];

  const overdue = db.prepare(`
    SELECT a.title, a.deadline, u.name AS unit_name
    FROM assignments a JOIN units u ON a.unit_id = u.id
    WHERE a.status != 'completed' AND a.deadline < datetime('now')
    ORDER BY a.deadline ASC LIMIT 5
  `).all();

  const dueToday = db.prepare(`
    SELECT a.title, u.name AS unit_name
    FROM assignments a JOIN units u ON a.unit_id = u.id
    WHERE a.status != 'completed' AND date(a.deadline) = date('now')
  `).all();

  const upcoming = db.prepare(`
    SELECT a.title, a.deadline, u.name AS unit_name
    FROM assignments a JOIN units u ON a.unit_id = u.id
    WHERE a.status != 'completed' AND a.deadline >= datetime('now')
    ORDER BY a.deadline ASC LIMIT 5
  `).all();

  const weakTopics = db.prepare(`
    SELECT tw.topic_name, u.name AS unit_name, tw.weakness_score
    FROM topic_weakness tw JOIN units u ON tw.unit_id = u.id
    ORDER BY tw.weakness_score DESC LIMIT 5
  `).all();

  const studyToday = db.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) AS minutes
    FROM study_sessions WHERE date(studied_at) = date('now')
  `).get().minutes;

  const unreadAlerts = db.prepare(`
    SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0
  `).get().count;

  const todayTimetable = db.prepare(`
    SELECT t.start_time, t.end_time, u.name AS unit_name, t.label
    FROM timetable_slots t LEFT JOIN units u ON t.unit_id = u.id
    WHERE t.day_of_week = ? ORDER BY t.start_time
  `).all(new Date().getDay());

  const journalToday = db.prepare(`
    SELECT COUNT(*) AS count FROM training_logs WHERE log_date = date('now')
  `).get().count;

  if (overdue.length) {
    lines.push(`🚨 *OVERDUE (${overdue.length})*`);
    overdue.forEach((a) => lines.push(`• ${a.title} — ${a.unit_name}`));
    lines.push('');
  }

  if (dueToday.length) {
    lines.push(`⏰ *DUE TODAY (${dueToday.length})*`);
    dueToday.forEach((a) => lines.push(`• ${a.title} — ${a.unit_name}`));
    lines.push('');
  }

  if (upcoming.length) {
    lines.push('📋 *UPCOMING DEADLINES*');
    upcoming.forEach((a) => {
      const d = new Date(a.deadline).toLocaleDateString();
      lines.push(`• ${a.title} (${a.unit_name}) — ${d}`);
    });
    lines.push('');
  }

  if (todayTimetable.length) {
    lines.push('📅 *TODAY\'S SCHEDULE*');
    todayTimetable.forEach((s) => {
      lines.push(`• ${s.start_time}–${s.end_time} ${s.unit_name || s.label || 'Study'}`);
    });
    lines.push('');
  }

  if (weakTopics.length) {
    lines.push('⚠️ *WEAK TOPICS — REVIEW*');
    weakTopics.forEach((t) => lines.push(`• ${t.topic_name} (${t.unit_name})`));
    lines.push('');
  }

  lines.push(`📖 Studied today: ${formatMinutes(studyToday)}`);
  lines.push(`🔔 Unread alerts: ${unreadAlerts}`);
  if (!journalToday) lines.push('📝 Journal not logged today — keep your streak!');

  const baseUrl = process.env.APP_URL || 'http://localhost:3001';
  lines.push('', `Open StudyFlow: ${baseUrl}`);

  return lines.join('\n');
}

function buildQuizResultMessage({ quiz_title, unit_name, score, total, percentage, weak_topics }) {
  const lines = [
    '📝 *Quiz Complete*',
    '',
    `Quiz: ${quiz_title}`,
    `Unit: ${unit_name}`,
    `Score: ${score}/${total} (${percentage}%)`,
  ];

  if (weak_topics?.length) {
    lines.push('', '⚠️ *Weak topics to review:*');
    weak_topics.forEach(({ topic, count }) => lines.push(`• ${topic} (${count} missed)`));
    lines.push('', 'Study sessions were scheduled for these topics.');
  }

  return lines.join('\n');
}

async function sendDailyDigest() {
  const { isAnyConfigured } = require('./messaging');
  if (!isAnyConfigured()) return { sent: false, reason: 'not configured' };

  const today = new Date().toISOString().slice(0, 10);
  const text = buildDailyDigest();
  return sendNotification(text, { messageKey: `daily-digest:${today}` });
}

async function sendAlert(message, notificationId) {
  const { isAnyConfigured } = require('./messaging');
  if (!isAnyConfigured()) return { sent: false, reason: 'not configured' };

  const text = `🔔 *StudyFlow Alert*\n\n${message}`;
  return sendNotification(text, { messageKey: `notification:${notificationId}` });
}

async function sendQuizWhatsApp(payload) {
  const { isAnyConfigured } = require('./messaging');
  if (!isAnyConfigured()) return { sent: false, reason: 'not configured' };

  const text = buildQuizResultMessage(payload);
  return sendNotification(text, {
    messageKey: `quiz:${payload.quiz_id}:${payload.attempt_id || Date.now()}`,
  });
}

module.exports = {
  buildDailyDigest,
  buildQuizResultMessage,
  sendDailyDigest,
  sendAlert,
  sendQuizWhatsApp,
};
