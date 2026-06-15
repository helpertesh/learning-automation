const crypto = require('crypto');
const db = require('../db');
const { sendWhatsApp, isConfigured: isWhatsAppConfigured } = require('./whatsapp');
const { sendTelegram, isTelegramConfigured } = require('./telegram');

function getChannels() {
  const raw = process.env.NOTIFY_CHANNELS || 'telegram';
  return raw.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
}

function isAnyConfigured() {
  const channels = getChannels();
  if (channels.includes('whatsapp') && isWhatsAppConfigured()) return true;
  if (channels.includes('telegram') && isTelegramConfigured()) return true;
  return false;
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

async function alreadySent(messageKey) {
  const row = await db.prepare('SELECT id FROM whatsapp_log WHERE message_key = ?').get(hashKey(messageKey));
  return !!row;
}

async function logSent(messageKey, preview) {
  await db.prepare(`
    INSERT INTO whatsapp_log (message_key, message_preview) VALUES (?, ?)
    ON CONFLICT (message_key) DO NOTHING
  `).run(hashKey(messageKey), (preview || '').slice(0, 200));
}

async function sendNotification(text, { messageKey, skipDedup = false } = {}) {
  if (!isAnyConfigured()) return { sent: false, reason: 'No messaging channel configured' };

  const key = messageKey || text.slice(0, 100);
  if (!skipDedup && await alreadySent(key)) return { sent: false, reason: 'duplicate' };

  const channels = getChannels();
  const results = [];

  if (channels.includes('telegram') && isTelegramConfigured()) {
    try {
      const r = await sendTelegram(text);
      results.push({ channel: 'telegram', sent: true, ...r });
    } catch (err) {
      results.push({ channel: 'telegram', sent: false, error: err.message });
    }
  }

  if (channels.includes('whatsapp') && isWhatsAppConfigured()) {
    try {
      const r = await sendWhatsApp(text, { messageKey: key, skipDedup: true });
      results.push({ channel: 'whatsapp', ...r });
    } catch (err) {
      results.push({ channel: 'whatsapp', sent: false, error: err.message });
    }
  }

  const anySent = results.some((r) => r.sent);
  if (anySent) await logSent(key, text);

  return { sent: anySent, results };
}

function getStatus() {
  const channels = getChannels();
  return {
    enabled: isAnyConfigured(),
    channels,
    telegram: {
      enabled: isTelegramConfigured(),
      chat_id: process.env.TELEGRAM_CHAT_ID ? '***' + String(process.env.TELEGRAM_CHAT_ID).slice(-4) : null,
    },
    whatsapp: {
      enabled: isWhatsAppConfigured(),
      provider: process.env.WHATSAPP_PROVIDER || 'callmebot',
      phone: process.env.WHATSAPP_PHONE ? '***' + process.env.WHATSAPP_PHONE.slice(-4) : null,
      callmebot_ready: !!process.env.CALLMEBOT_API_KEY,
      twilio_ready: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    },
    daily_digest: process.env.WHATSAPP_DAILY_DIGEST !== 'false' && process.env.TELEGRAM_DAILY_DIGEST !== 'false',
    digest_hour: Number(process.env.WHATSAPP_DIGEST_HOUR || process.env.TELEGRAM_DIGEST_HOUR || 8),
  };
}

module.exports = { sendNotification, isAnyConfigured, getStatus, getChannels };
