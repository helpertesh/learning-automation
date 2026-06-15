const express = require('express');
const db = require('../db');
const { generateDeadlineNotifications, processWhatsAppAlerts } = require('../services/notifications');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    await generateDeadlineNotifications();
    processWhatsAppAlerts().catch(() => {});

    const stats = {
      units: (await db.prepare('SELECT COUNT(*) AS count FROM units').get()).count,
      notes: (await db.prepare('SELECT COUNT(*) AS count FROM notes').get()).count,
      past_papers: (await db.prepare('SELECT COUNT(*) AS count FROM past_papers').get()).count,
      pending_assignments: (await db.prepare("SELECT COUNT(*) AS count FROM assignments WHERE status != 'completed'").get()).count,
      unread_notifications: (await db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0').get()).count,
    };

    const upcoming = await db.prepare(`
      SELECT a.*, u.name AS unit_name, u.color AS unit_color
      FROM assignments a JOIN units u ON a.unit_id = u.id
      WHERE a.status != 'completed' AND a.deadline >= datetime('now')
      ORDER BY a.deadline ASC LIMIT 5
    `).all();

    const overdue = await db.prepare(`
      SELECT a.*, u.name AS unit_name, u.color AS unit_color
      FROM assignments a JOIN units u ON a.unit_id = u.id
      WHERE a.status != 'completed' AND a.deadline < datetime('now')
      ORDER BY a.deadline ASC LIMIT 5
    `).all();

    const recentNotes = await db.prepare(`
      SELECT n.*, u.name AS unit_name FROM notes n
      JOIN units u ON n.unit_id = u.id ORDER BY n.created_at DESC LIMIT 5
    `).all();

    const studyStats = await db.prepare(`
      SELECT COALESCE(SUM(duration_minutes), 0) AS today_minutes
      FROM study_sessions WHERE date(studied_at) = date('now')
    `).get();

    const trainingDates = (await db.prepare(`
      SELECT DISTINCT log_date FROM training_logs ORDER BY log_date DESC
    `).all()).map((r) => r.log_date);

    let trainingStreak = 0;
    const today = new Date();
    for (let i = 0; i < trainingDates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);
      const logDate = String(trainingDates[i]).slice(0, 10);
      if (logDate === expectedStr) trainingStreak++;
      else break;
    }

    const todayJournal = (await db.prepare(`
      SELECT COUNT(*) AS count FROM training_logs WHERE log_date = date('now')
    `).get()).count;

    const todayTimetable = await db.prepare(`
      SELECT t.*, u.name AS unit_name, u.color AS unit_color
      FROM timetable_slots t LEFT JOIN units u ON t.unit_id = u.id
      WHERE t.day_of_week = ?
      ORDER BY t.start_time
    `).all(new Date().getDay());

    const quizStats = {
      total_quizzes: (await db.prepare('SELECT COUNT(*) AS count FROM quizzes').get()).count,
      total_attempts: (await db.prepare("SELECT COUNT(*) AS count FROM quiz_attempts WHERE completed_at IS NOT NULL").get()).count,
      summaries: (await db.prepare('SELECT COUNT(*) AS count FROM note_summaries').get()).count,
      avg_score: (await db.prepare(`
        SELECT ROUND(AVG(CAST(score AS REAL) / NULLIF(total, 0)) * 100) AS avg
        FROM quiz_attempts WHERE completed_at IS NOT NULL AND total > 0
      `).get()).avg || 0,
    };

    const weakTopics = await db.prepare(`
      SELECT tw.*, u.name AS unit_name, u.color AS unit_color
      FROM topic_weakness tw JOIN units u ON tw.unit_id = u.id
      ORDER BY tw.weakness_score DESC LIMIT 5
    `).all();

    const recentQuizAttempts = (await db.prepare(`
      SELECT a.score, a.total, a.completed_at, q.title AS quiz_title, u.name AS unit_name
      FROM quiz_attempts a
      JOIN quizzes q ON a.quiz_id = q.id
      JOIN units u ON q.unit_id = u.id
      WHERE a.completed_at IS NOT NULL
      ORDER BY a.completed_at DESC LIMIT 3
    `).all()).map((a) => ({
      ...a,
      percentage: a.total ? Math.round((a.score / a.total) * 100) : 0,
    }));

    const todaySkillLesson = await db.prepare(`
      SELECT id, title, skill_category, completed FROM daily_it_lessons WHERE lesson_date = date('now')
    `).get();

    const skillStreakDates = (await db.prepare(`
      SELECT DISTINCT lesson_date FROM daily_it_lessons WHERE completed = 1 ORDER BY lesson_date DESC
    `).all()).map((r) => r.lesson_date);

    let skillStreak = 0;
    for (let i = 0; i < skillStreakDates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);
      const lessonDate = String(skillStreakDates[i]).slice(0, 10);
      if (lessonDate === expectedStr) skillStreak++;
      else break;
    }

    res.json({
      stats, upcoming, overdue, recentNotes, studyStats, trainingStreak, todayJournal,
      todayTimetable, quizStats, weakTopics, recentQuizAttempts,
      todaySkillLesson, skillStreak,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
