const db = require('../db');
const { chatJSON, isAIConfigured, getLastAIError } = require('./openai');

const SKILL_CATEGORIES = [
  { id: 'cybersecurity', label: 'Cybersecurity', emoji: '🛡️' },
  { id: 'video_editing', label: 'Video Editing', emoji: '🎬' },
  { id: 'web_development', label: 'Web Development', emoji: '🌐' },
  { id: 'cloud_devops', label: 'Cloud & DevOps', emoji: '☁️' },
  { id: 'data_ai', label: 'Data & AI', emoji: '🤖' },
  { id: 'mobile_dev', label: 'Mobile Development', emoji: '📱' },
  { id: 'ui_ux', label: 'UI/UX Design', emoji: '🎨' },
  { id: 'networking', label: 'Networking', emoji: '🔗' },
  { id: 'linux_sysadmin', label: 'Linux & Sysadmin', emoji: '🐧' },
  { id: 'digital_marketing', label: 'Digital Marketing', emoji: '📈' },
  { id: 'programming', label: 'Programming', emoji: '💻' },
  { id: 'blockchain', label: 'Blockchain & Web3', emoji: '⛓️' },
];

const FALLBACK_LESSONS = {
  cybersecurity: {
    title: 'Password Managers & 2FA Basics',
    overview: 'Learn why password reuse is dangerous and how password managers plus two-factor authentication protect your accounts.',
    key_concepts: ['Password reuse risks', 'How password managers work', 'TOTP vs SMS 2FA', 'Phishing awareness'],
    practical_task: 'Install a free password manager (Bitwarden or KeePass), migrate 3 accounts, and enable 2FA on your email.',
    resources: [
      { name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com' },
      { name: 'Bitwarden', url: 'https://bitwarden.com' },
    ],
  },
  video_editing: {
    title: 'The J-Cut and L-Cut',
    overview: 'Professional editors use J-cuts and L-cuts to make dialogue scenes flow naturally instead of feeling choppy.',
    key_concepts: ['J-cut: audio leads video', 'L-cut: video leads audio', 'Continuity editing', 'Pacing in dialogue'],
    practical_task: 'In CapCut or DaVinci Resolve, edit a 30-second clip using at least one J-cut and one L-cut.',
    resources: [
      { name: 'DaVinci Resolve (free)', url: 'https://www.blackmagicdesign.com/products/davinciresolve' },
    ],
  },
  web_development: {
    title: 'CSS Grid vs Flexbox — When to Use Each',
    overview: 'Flexbox excels at one-dimensional layouts; Grid handles two-dimensional layouts. Knowing both makes you faster.',
    key_concepts: ['Flexbox for rows/columns', 'Grid for page layouts', 'gap property', 'Responsive breakpoints'],
    practical_task: 'Build a simple dashboard layout: sidebar + header + main content using CSS Grid.',
    resources: [
      { name: 'CSS Grid Garden', url: 'https://cssgridgarden.com' },
      { name: 'Flexbox Froggy', url: 'https://flexboxfroggy.com' },
    ],
  },
  cloud_devops: {
    title: 'What is Docker in 5 Minutes',
    overview: 'Docker packages apps with their dependencies so they run the same everywhere — your laptop, a server, or the cloud.',
    key_concepts: ['Containers vs VMs', 'Images and containers', 'Dockerfile basics', 'Why DevOps teams use it'],
    practical_task: 'Install Docker Desktop and run: docker run hello-world',
    resources: [
      { name: 'Docker Getting Started', url: 'https://docs.docker.com/get-started/' },
    ],
  },
  data_ai: {
    title: 'Prompt Engineering Fundamentals',
    overview: 'Getting good results from AI tools means being specific: role, context, format, and constraints in your prompts.',
    key_concepts: ['Clear instructions', 'Few-shot examples', 'Chain-of-thought', 'Output formatting'],
    practical_task: 'Write 3 prompts for the same task (bad, okay, excellent) and compare the AI outputs.',
    resources: [
      { name: 'OpenAI Prompt Guide', url: 'https://platform.openai.com/docs/guides/prompt-engineering' },
    ],
  },
  mobile_dev: {
    title: 'React Native vs Flutter — Quick Comparison',
    overview: 'Both let you build mobile apps with one codebase. React Native uses JavaScript; Flutter uses Dart with custom widgets.',
    key_concepts: ['Cross-platform development', 'Native performance', 'Hot reload', 'Community & jobs market'],
    practical_task: 'Try Expo Snack (React Native) or DartPad (Flutter) and build a simple counter app.',
    resources: [
      { name: 'Expo Snack', url: 'https://snack.expo.dev' },
    ],
  },
  ui_ux: {
    title: 'The 8-Point Grid System',
    overview: 'Designers use multiples of 8px for spacing and sizing so layouts feel consistent across devices.',
    key_concepts: ['Visual rhythm', 'Spacing scale (8, 16, 24, 32)', 'Typography alignment', 'Design tokens'],
    practical_task: 'Redesign a simple card component using only 8px multiples for padding and margins.',
    resources: [
      { name: 'Material Design spacing', url: 'https://m3.material.io/foundations/layout/understanding-layout/spacing' },
    ],
  },
  networking: {
    title: 'DNS Explained Simply',
    overview: 'DNS translates human-readable domain names (google.com) into IP addresses computers use to connect.',
    key_concepts: ['Domain → IP lookup', 'DNS records (A, CNAME, MX)', 'TTL', 'Common DNS tools (nslookup, dig)'],
    practical_task: 'Run nslookup on your favorite website and identify the IP address returned.',
    resources: [
      { name: 'How DNS Works (comic)', url: 'https://howdns.works' },
    ],
  },
  linux_sysadmin: {
    title: 'Essential Linux Commands for Beginners',
    overview: 'Master these commands and you can navigate, inspect, and manage any Linux server or WSL environment.',
    key_concepts: ['ls, cd, pwd', 'grep and pipes', 'chmod permissions', 'systemctl for services'],
    practical_task: 'Open WSL or a Linux VM and complete: list files, search logs with grep, check disk space with df -h.',
    resources: [
      { name: 'Linux Journey', url: 'https://linuxjourney.com' },
    ],
  },
  digital_marketing: {
    title: 'SEO Basics: Title Tags & Meta Descriptions',
    overview: 'Search engines use title tags and meta descriptions to understand and display your pages in results.',
    key_concepts: ['Primary keywords in titles', 'Meta description length (~155 chars)', 'Click-through rate', 'Heading hierarchy (H1-H3)'],
    practical_task: 'Audit one webpage: write an improved title tag and meta description for it.',
    resources: [
      { name: 'Google Search Central', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
    ],
  },
  programming: {
    title: 'Git Branching Workflow',
    overview: 'Professional teams use branches to work on features without breaking the main codebase.',
    key_concepts: ['main vs feature branches', 'git checkout -b', 'Pull requests', 'Merge vs rebase basics'],
    practical_task: 'Create a repo, make a feature branch, commit a change, and merge it back to main.',
    resources: [
      { name: 'Learn Git Branching', url: 'https://learngitbranching.js.org' },
    ],
  },
  blockchain: {
    title: 'What is a Smart Contract?',
    overview: 'Smart contracts are self-executing programs on blockchains that run when conditions are met — no middleman needed.',
    key_concepts: ['Blockchain basics', 'Ethereum & Solidity intro', 'Use cases (DeFi, NFTs)', 'Gas fees concept'],
    practical_task: 'Read about one real smart contract use case and explain it in your own words.',
    resources: [
      { name: 'Ethereum.org Learn', url: 'https://ethereum.org/en/developers/docs/' },
    ],
  },
};

function getCategories() {
  return SKILL_CATEGORIES;
}

function getUserSkills() {
  return db.prepare('SELECT * FROM user_it_skills ORDER BY skill_name').all();
}

function saveUserSkills(skills) {
  db.exec('DELETE FROM user_it_skills');
  const insert = db.prepare('INSERT INTO user_it_skills (skill_name, level) VALUES (?, ?)');
  for (const s of skills) {
    if (s.skill_name?.trim()) {
      insert.run(s.skill_name.trim(), s.level || 'beginner');
    }
  }
  return getUserSkills();
}

function getTodayLesson() {
  return db.prepare(`
    SELECT * FROM daily_it_lessons WHERE lesson_date = date('now')
  `).get();
}

function getLessonById(id) {
  return db.prepare('SELECT * FROM daily_it_lessons WHERE id = ?').get(id);
}

function getRecentLessons(limit = 30) {
  return db.prepare(`
    SELECT * FROM daily_it_lessons ORDER BY lesson_date DESC LIMIT ?
  `).all(limit);
}

function getRecentCategories(days = 14) {
  return db.prepare(`
    SELECT skill_category FROM daily_it_lessons
    WHERE lesson_date >= date('now', ?)
    ORDER BY lesson_date DESC
  `).all(`-${days} days`).map((r) => r.skill_category);
}

function pickCategory(requestedCategory) {
  if (requestedCategory && FALLBACK_LESSONS[requestedCategory]) {
    return requestedCategory;
  }

  const userSkills = getUserSkills().map((s) => s.skill_name.toLowerCase());
  const recent = getRecentCategories();
  const candidates = SKILL_CATEGORIES.map((c) => c.id);

  const skipWebDev = userSkills.some((s) =>
    s.includes('web') || s.includes('website') || s.includes('frontend'),
  );

  const filtered = candidates.filter((id) => {
    if (skipWebDev && id === 'web_development' && Math.random() > 0.2) return false;
    if (recent.includes(id)) return false;
    return true;
  });

  const pool = filtered.length ? filtered : candidates.filter((id) => !recent.includes(id));
  const finalPool = pool.length ? pool : candidates;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

function parseLessonRow(row) {
  if (!row) return null;
  return {
    ...row,
    key_concepts: row.key_concepts_json ? JSON.parse(row.key_concepts_json) : [],
    resources: row.resources_json ? JSON.parse(row.resources_json) : [],
    completed: !!row.completed,
  };
}

async function generateLesson({ category, forceRegenerate = false } = {}) {
  const existing = getTodayLesson();
  if (existing && !forceRegenerate) {
    return parseLessonRow(existing);
  }

  const skillCategory = pickCategory(category);
  const userSkills = getUserSkills();
  const recentLessons = getRecentLessons(7);
  const categoryMeta = SKILL_CATEGORIES.find((c) => c.id === skillCategory);

  let lesson;

  if (isAIConfigured()) {
    lesson = await generateWithAI(skillCategory, categoryMeta, userSkills, recentLessons);
  }

  if (!lesson) {
    const fallback = FALLBACK_LESSONS[skillCategory];
    lesson = {
      skill_category: skillCategory,
      title: fallback.title,
      overview: fallback.overview,
      key_concepts: fallback.key_concepts,
      practical_task: fallback.practical_task,
      resources: fallback.resources,
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  if (existing && forceRegenerate) {
    db.prepare(`
      UPDATE daily_it_lessons
      SET skill_category = ?, title = ?, overview = ?, key_concepts_json = ?,
          practical_task = ?, resources_json = ?, reflection = NULL, completed = 0, duration_minutes = NULL
      WHERE id = ?
    `).run(
      lesson.skill_category,
      lesson.title,
      lesson.overview,
      JSON.stringify(lesson.key_concepts || []),
      lesson.practical_task,
      JSON.stringify(lesson.resources || []),
      existing.id,
    );
    return parseLessonRow(getLessonById(existing.id));
  }

  const result = db.prepare(`
    INSERT INTO daily_it_lessons
    (lesson_date, skill_category, title, overview, key_concepts_json, practical_task, resources_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    today,
    lesson.skill_category,
    lesson.title,
    lesson.overview,
    JSON.stringify(lesson.key_concepts || []),
    lesson.practical_task,
    JSON.stringify(lesson.resources || []),
  );

  return parseLessonRow(getLessonById(result.lastInsertRowid));
}

async function generateWithAI(category, categoryMeta, userSkills, recentLessons) {
  const skillsList = userSkills.map((s) => `${s.skill_name} (${s.level})`).join(', ') || 'None listed';
  const recentList = recentLessons.map((l) => `${l.lesson_date}: ${l.title} (${l.skill_category})`).join('\n') || 'None';

  const prompt = `You are an IT career coach teaching in-demand skills to a learner.

Generate ONE daily micro-lesson (15-30 min) in the "${categoryMeta?.label || category}" category.

Learner's existing skills (avoid repeating basics they already know): ${skillsList}

Recent lessons (do NOT repeat these topics):
${recentList}

Return JSON only:
{
  "skill_category": "${category}",
  "title": "Short catchy lesson title",
  "overview": "2-3 sentences explaining why this matters in today's job market",
  "key_concepts": ["concept 1", "concept 2", "concept 3", "concept 4"],
  "practical_task": "One hands-on task they can do today in 15-30 minutes with free tools",
  "resources": [{"name": "Resource name", "url": "https://..."}]
}

Focus on practical, current, in-demand skills. Be specific and actionable.`;

  const result = await chatJSON(prompt, { temperature: 0.7 });
  if (!result?.title) {
    console.warn('AI lesson generation failed:', getLastAIError());
    return null;
  }

  return {
    skill_category: result.skill_category || category,
    title: result.title,
    overview: result.overview,
    key_concepts: result.key_concepts || [],
    practical_task: result.practical_task,
    resources: result.resources || [],
  };
}

function completeLesson(id, { reflection, duration_minutes } = {}) {
  const lesson = getLessonById(id);
  if (!lesson) return null;

  db.prepare(`
    UPDATE daily_it_lessons
    SET completed = 1, reflection = ?, duration_minutes = ?
    WHERE id = ?
  `).run(
    reflection?.trim() || null,
    duration_minutes ?? null,
    id,
  );

  return parseLessonRow(getLessonById(id));
}

function getStreak() {
  const dates = db.prepare(`
    SELECT DISTINCT lesson_date FROM daily_it_lessons WHERE completed = 1 ORDER BY lesson_date DESC
  `).all().map((r) => r.lesson_date);

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (dates[i] === expected.toISOString().slice(0, 10)) streak++;
    else break;
  }

  const total = db.prepare('SELECT COUNT(*) AS count FROM daily_it_lessons WHERE completed = 1').get().count;
  const categoriesExplored = db.prepare('SELECT COUNT(DISTINCT skill_category) AS count FROM daily_it_lessons').get().count;

  return { streak_days: streak, total_completed: total, categories_explored: categoriesExplored };
}

module.exports = {
  getCategories,
  getUserSkills,
  saveUserSkills,
  getTodayLesson: () => parseLessonRow(getTodayLesson()),
  getRecentLessons: (limit) => getRecentLessons(limit).map(parseLessonRow),
  generateLesson,
  completeLesson,
  getStreak,
  parseLessonRow,
};
