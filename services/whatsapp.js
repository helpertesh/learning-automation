const crypto = require('crypto');
const db = require('../db');

function isConfigured() {
  return process.env.WHATSAPP_ENABLED === 'true' && !!process.env.WHATSAPP_PHONE;
}

function getProvider() {
  return (process.env.WHATSAPP_PROVIDER || 'callmebot').toLowerCase();
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

function alreadySent(messageKey) {
  const row = db.prepare('SELECT id FROM whatsapp_log WHERE message_key = ?').get(hashKey(messageKey));
  return !!row;
}

function logSent(messageKey, preview) {
  db.prepare(`
    INSERT OR IGNORE INTO whatsapp_log (message_key, message_preview) VALUES (?, ?)
  `).run(hashKey(messageKey), (preview || '').slice(0, 200));
}

async function sendViaCallMeBot(text) {
  const phone = process.env.WHATSAPP_PHONE.replace(/\D/g, '');
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) throw new Error('CALLMEBOT_API_KEY is required for CallMeBot');

  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`CallMeBot error: ${body}`);
  return { provider: 'callmebot', response: body };
}

async function sendViaTwilio(text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.WHATSAPP_PHONE.startsWith('whatsapp:')
    ? process.env.WHATSAPP_PHONE
    : `whatsapp:${process.env.WHATSAPP_PHONE}`;

  if (!sid || !token || !from) {
    throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM required');
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: text }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Twilio send failed');
  return { provider: 'twilio', sid: data.sid };
}

async function sendWhatsApp(text, { messageKey, skipDedup = false } = {}) {
  if (!isConfigured()) return { sent: false, reason: 'WhatsApp not configured' };

  const key = messageKey || text.slice(0, 100);
  if (!skipDedup && alreadySent(key)) return { sent: false, reason: 'duplicate' };

  const provider = getProvider();
  let result;
  if (provider === 'twilio') {
    result = await sendViaTwilio(text);
  } else {
    result = await sendViaCallMeBot(text);
  }

  logSent(key, text);
  return { sent: true, ...result };
}

function getStatus() {
  const provider = getProvider();
  return {
    enabled: isConfigured(),
    provider,
    phone: process.env.WHATSAPP_PHONE ? '***' + process.env.WHATSAPP_PHONE.slice(-4) : null,
    daily_digest: process.env.WHATSAPP_DAILY_DIGEST !== 'false',
    digest_hour: Number(process.env.WHATSAPP_DIGEST_HOUR || 8),
    callmebot_ready: !!process.env.CALLMEBOT_API_KEY,
    twilio_ready: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  };
}

module.exports = { sendWhatsApp, isConfigured, getStatus, alreadySent };
