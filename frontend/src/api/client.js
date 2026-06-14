const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  dashboard: () => request('/dashboard'),
  units: {
    list: () => request('/units'),
    get: (id) => request(`/units/${id}`),
    create: (body) => request('/units', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    update: (id, body) => request(`/units/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    delete: (id) => request(`/units/${id}`, { method: 'DELETE' }),
  },
  notes: {
    list: (unitId) => request(`/notes${unitId ? `?unit_id=${unitId}` : ''}`),
    upload: (formData) => request('/notes', { method: 'POST', body: formData }),
    delete: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
    downloadUrl: (id) => `${BASE}/notes/${id}/download`,
    summarize: (id) => request(`/notes/${id}/summarize`, { method: 'POST' }),
    getSummary: (id) => request(`/notes/${id}/summary`),
    getQuizzes: (id) => request(`/notes/${id}/quizzes`),
  },
  pastPapers: {
    list: (unitId) => request(`/past-papers${unitId ? `?unit_id=${unitId}` : ''}`),
    upload: (formData) => request('/past-papers', { method: 'POST', body: formData }),
    delete: (id) => request(`/past-papers/${id}`, { method: 'DELETE' }),
    downloadUrl: (id) => `${BASE}/past-papers/${id}/download`,
  },
  assignments: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/assignments${q ? `?${q}` : ''}`);
    },
    upcoming: () => request('/assignments/upcoming'),
    create: (body) => request('/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    update: (id, body) => request(`/assignments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    delete: (id) => request(`/assignments/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    list: () => request('/notifications'),
    unreadCount: () => request('/notifications/unread-count'),
    markRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  },
  studySessions: {
    list: (days) => request(`/study-sessions?days=${days || 30}`),
    stats: () => request('/study-sessions/stats'),
    create: (body) => request('/study-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    delete: (id) => request(`/study-sessions/${id}`, { method: 'DELETE' }),
  },
  trainingLogs: {
    list: (days) => request(`/training-logs?days=${days || 60}`),
    today: () => request('/training-logs/today'),
    streak: () => request('/training-logs/streak'),
    create: (body) => request('/training-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    update: (id, body) => request(`/training-logs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    delete: (id) => request(`/training-logs/${id}`, { method: 'DELETE' }),
  },
  calendar: {
    get: (month) => request(`/calendar${month ? `?month=${month}` : ''}`),
  },
  topics: {
    list: (unitId) => request(`/topics?unit_id=${unitId}`),
    create: (body) => request('/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    bulk: (body) => request('/topics/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    toggleCover: (id, isCovered) => request(`/topics/${id}/cover`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_covered: isCovered }) }),
    delete: (id) => request(`/topics/${id}`, { method: 'DELETE' }),
  },
  timetable: {
    list: () => request('/timetable'),
    today: () => request('/timetable/today'),
    create: (body) => request('/timetable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    update: (id, body) => request(`/timetable/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    delete: (id) => request(`/timetable/${id}`, { method: 'DELETE' }),
  },
  examPrep: {
    get: (unitId) => request(`/exam-prep/${unitId}`),
    analyze: (body) => request('/exam-prep/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  },
  quizzes: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/quizzes${q ? `?${q}` : ''}`);
    },
    get: (id) => request(`/quizzes/${id}`),
    generate: (noteId) => request('/quizzes/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_id: noteId }) }),
    submit: (id, answers) => request(`/quizzes/${id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) }),
    weakTopics: (unitId) => request(`/quizzes/weak-topics${unitId ? `?unit_id=${unitId}` : ''}`),
    attempts: (id) => request(`/quizzes/${id}/attempts`),
  },
  automation: {
    weakTopics: () => request('/automation/weak-topics'),
    quizProgress: () => request('/automation/quiz-progress'),
  },
  whatsapp: {
    status: () => request('/whatsapp/status'),
    test: () => request('/whatsapp/test', { method: 'POST' }),
    sendDigest: () => request('/whatsapp/digest', { method: 'POST' }),
    previewDigest: () => request('/whatsapp/digest/preview'),
    syncAlerts: () => request('/whatsapp/sync-alerts', { method: 'POST' }),
  },
  ai: {
    status: () => request('/ai/status'),
    test: () => request('/ai/test', { method: 'POST' }),
  },
  skillLearning: {
    today: () => request('/skill-learning/today'),
    history: (limit) => request(`/skill-learning/history?limit=${limit || 30}`),
    categories: () => request('/skill-learning/categories'),
    skills: () => request('/skill-learning/skills'),
    saveSkills: (skills) => request('/skill-learning/skills', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills }),
    }),
    streak: () => request('/skill-learning/streak'),
    generate: (body) => request('/skill-learning/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    complete: (id, body) => request(`/skill-learning/${id}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  },
};
