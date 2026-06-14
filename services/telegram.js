async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required');
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    // Retry without markdown if formatting fails
    const retry = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const retryData = await retry.json();
    if (!retryData.ok) throw new Error(retryData.description || 'Telegram send failed');
    return { provider: 'telegram', message_id: retryData.result.message_id };
  }

  return { provider: 'telegram', message_id: data.result.message_id };
}

function isTelegramConfigured() {
  return process.env.TELEGRAM_ENABLED === 'true'
    && !!process.env.TELEGRAM_BOT_TOKEN
    && !!process.env.TELEGRAM_CHAT_ID;
}

module.exports = { sendTelegram, isTelegramConfigured };
