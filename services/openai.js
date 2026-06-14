let lastError = null;

function getAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const provider = process.env.AI_PROVIDER || (baseUrl.includes('openrouter') ? 'openrouter' : 'openai');

  return { apiKey, baseUrl, model, provider };
}

function isAIConfigured() {
  return !!getAIConfig().apiKey;
}

function getLastAIError() {
  return lastError;
}

async function chatCompletion(messages, { temperature = 0.3, jsonMode = false } = {}) {
  const { apiKey, baseUrl, model, provider } = getAIConfig();
  if (!apiKey) {
    lastError = 'OPENAI_API_KEY not set in backend/.env';
    return null;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:3001';
    headers['X-Title'] = 'StudyFlow';
  }

  const body = {
    model,
    messages,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      lastError = data.error?.message || data.message || `API error ${res.status}`;
      console.warn('AI API error:', lastError);
      return null;
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      lastError = 'Empty response from AI';
      return null;
    }

    lastError = null;
    return content;
  } catch (err) {
    lastError = err.message;
    console.warn('AI request failed:', err.message);
    return null;
  }
}

async function chatJSON(prompt, options = {}) {
  const content = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { ...options, jsonMode: true },
  );
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    lastError = 'AI returned invalid JSON';
    return null;
  }
}

async function testConnection() {
  const { apiKey, baseUrl, model, provider } = getAIConfig();
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY not set. Add it to backend/.env and restart the server.' };
  }

  const content = await chatCompletion(
    [{ role: 'user', content: 'Reply with exactly: StudyFlow AI connected' }],
    { temperature: 0 },
  );

  if (!content) {
    return { ok: false, error: lastError || 'Connection failed', model, provider, baseUrl };
  }

  return {
    ok: true,
    model,
    provider,
    response: content.slice(0, 100),
  };
}

module.exports = {
  getAIConfig,
  isAIConfigured,
  getLastAIError,
  chatJSON,
  chatCompletion,
  testConnection,
};
