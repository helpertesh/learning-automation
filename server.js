require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

app.use(cors());
app.use(express.json());

async function start() {
  await db.init();

  app.use('/api/units', require('./routes/units'));
  app.use('/api/notes', require('./routes/notes'));
  app.use('/api/past-papers', require('./routes/pastPapers'));
  app.use('/api/assignments', require('./routes/assignments'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/study-sessions', require('./routes/studySessions'));
  app.use('/api/training-logs', require('./routes/trainingLogs'));
  app.use('/api/calendar', require('./routes/calendar'));
  app.use('/api/topics', require('./routes/topics'));
  app.use('/api/timetable', require('./routes/timetable'));
  app.use('/api/exam-prep', require('./routes/examPrep'));
  app.use('/api/quizzes', require('./routes/quizzes'));
  app.use('/api/automation', require('./routes/automation'));
  app.use('/api/whatsapp', require('./routes/whatsapp'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/dashboard', require('./routes/dashboard'));

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  const hasFrontend = fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));
  if (hasFrontend) {
    app.use(express.static(FRONTEND_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.status(503).send(
        'Frontend not built. Run: cd frontend && npm run build\nThen restart the server.',
      );
    });
  }

  app.listen(PORT, () => {
    if (hasFrontend) {
      console.log(`StudyFlow running at http://localhost:${PORT}`);
    } else {
      console.log(`API running at http://localhost:${PORT} (frontend not built — see above)`);
    }
    logAIStatus();
    startWhatsAppScheduler();
  });
}

function logAIStatus() {
  const { isAIConfigured, getAIConfig } = require('./services/openai');
  if (isAIConfigured()) {
    const { model, provider } = getAIConfig();
    console.log(`AI enabled (${provider} / ${model})`);
  } else {
    console.log('AI not configured — add OPENAI_API_KEY to backend/.env for smart summaries & quizzes');
  }
}

function startWhatsAppScheduler() {
  const { isAnyConfigured } = require('./services/messaging');
  const { sendDailyDigest } = require('./services/studyDigest');
  const { processWhatsAppAlerts } = require('./services/notifications');

  if (!isAnyConfigured()) return;

  console.log('Messaging notifications enabled (Telegram/WhatsApp)');

  // Check alerts every 30 minutes
  setInterval(() => {
    processWhatsAppAlerts().catch((err) => console.warn('WhatsApp alerts:', err.message));
  }, 30 * 60 * 1000);

  // Daily digest at configured hour
  const digestHour = Number(process.env.WHATSAPP_DIGEST_HOUR || 8);
  if (process.env.WHATSAPP_DAILY_DIGEST !== 'false') {
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === digestHour && now.getMinutes() < 5) {
        sendDailyDigest().catch((err) => console.warn('WhatsApp digest:', err.message));
      }
    }, 5 * 60 * 1000);
  }

  // Run once on startup (after 10s)
  setTimeout(() => {
    processWhatsAppAlerts().catch(() => {});
  }, 10000);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
