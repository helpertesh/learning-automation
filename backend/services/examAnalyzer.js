const path = require('path');
const db = require('../db');
const { extractText, normalizeText, splitIntoChunks } = require('./textExtractor');
const { chatJSON, isAIConfigured, getLastAIError } = require('./openai');

const UPLOADS = path.join(__dirname, '..', 'uploads');

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
}

function topicKeywords(topicName) {
  const words = topicName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return [...new Set(words)];
}

function textMatchesTopic(text, topicName) {
  const lower = text.toLowerCase();
  const keywords = topicKeywords(topicName);
  if (keywords.length === 0) return false;
  const hits = keywords.filter((k) => lower.includes(k)).length;
  return hits >= Math.max(1, Math.ceil(keywords.length * 0.5));
}

function extractQuestions(paperText) {
  const lines = paperText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const questions = [];
  let current = null;

  const questionStart = /^((?:question|q)\s*[\d]+[.):\-]?|(?:\d+)[.)]\s+)/i;

  for (const line of lines) {
    if (questionStart.test(line) || /^SECTION\s+[A-Z]/i.test(line)) {
      if (current) questions.push(current);
      current = { raw: line, lines: [line] };
    } else if (current) {
      current.lines.push(line);
      current.raw = current.lines.join(' ');
      if (current.lines.length >= 6) {
        questions.push(current);
        current = null;
      }
    }
  }
  if (current) questions.push(current);

  if (questions.length === 0) {
    return splitIntoChunks(normalizeText(paperText), 350).slice(0, 12).map((chunk, i) => ({
      raw: chunk,
      lines: [chunk],
      index: i + 1,
    }));
  }

  return questions.map((q, i) => ({ ...q, index: i + 1 }));
}

function findSolutionInNotes(topicName, notesTexts) {
  const keywords = topicKeywords(topicName);
  let best = { score: 0, excerpt: '', source: '' };

  for (const note of notesTexts) {
    const chunks = splitIntoChunks(note.text, 500);
    for (const chunk of chunks) {
      const lower = chunk.toLowerCase();
      const score = keywords.reduce((s, k) => s + (lower.includes(k) ? 1 : 0), 0);
      if (score > best.score) {
        best = { score, excerpt: chunk.slice(0, 600), source: note.title };
      }
    }
  }

  if (best.score === 0) {
    return {
      excerpt: 'No direct match in your notes. Review the topic section and add more detailed notes.',
      source: null,
      confidence: 'low',
    };
  }

  return {
    excerpt: best.excerpt,
    source: best.source,
    confidence: best.score >= 2 ? 'high' : 'medium',
  };
}

async function loadNotesTexts(unitId) {
  const notes = db.prepare('SELECT * FROM notes WHERE unit_id = ?').all(unitId);
  const results = [];

  for (const note of notes) {
    const filePath = path.join(UPLOADS, 'notes', note.filename);
    try {
      const text = normalizeText(await extractText(filePath));
      if (text) results.push({ id: note.id, title: note.title, text });
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

async function loadPaperText(paper) {
  const filePath = path.join(UPLOADS, 'past-papers', paper.filename);
  return normalizeText(await extractText(filePath));
}

async function analyzeWithAI(unit, coveredTopics, notesTexts, paperAnalyses) {
  if (!isAIConfigured()) return null;

  const prompt = `You are a study assistant. Analyze exam preparation for "${unit.name}".

COVERED TOPICS (only these are in scope):
${coveredTopics.map((t) => `- ${t.name}`).join('\n')}

NOTES EXCERPTS:
${notesTexts.slice(0, 5).map((n) => `[${n.title}]: ${n.text.slice(0, 800)}`).join('\n\n')}

PAST PAPER EXCERPTS:
${paperAnalyses.map((p) => `[${p.paperTitle}]: ${p.text.slice(0, 1200)}`).join('\n\n')}

Return JSON only with this shape:
{
  "summary": "brief study advice",
  "likely_questions": [
    {
      "question": "predicted question text",
      "topic": "matched topic",
      "from_paper": "paper title or General",
      "solution": "answer drawn from notes",
      "note_source": "note title",
      "priority": "high|medium|low"
    }
  ],
  "gaps": ["topics covered but weak in notes"],
  "study_tips": ["actionable tip"]
}`;

  const result = await chatJSON(prompt);
  if (!result && isAIConfigured()) {
    console.warn('Exam prep AI failed:', getLastAIError());
  }
  return result;
}

function analyzeRuleBased(unit, coveredTopics, notesTexts, papersWithText) {
  const likelyQuestions = [];
  const gaps = [];
  const seen = new Set();

  for (const paper of papersWithText) {
    const questions = extractQuestions(paper.text);

    for (const q of questions) {
      const matchedTopics = coveredTopics.filter((t) => textMatchesTopic(q.raw, t.name));
      if (matchedTopics.length === 0) continue;

      for (const topic of matchedTopics) {
        const key = `${topic.name}::${q.raw.slice(0, 80)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const solution = findSolutionInNotes(topic.name, notesTexts);
        likelyQuestions.push({
          question: q.raw.slice(0, 400),
          topic: topic.name,
          from_paper: paper.title,
          solution: solution.excerpt,
          note_source: solution.source,
          priority: solution.confidence === 'high' ? 'high' : 'medium',
          confidence: solution.confidence,
        });
      }
    }
  }

  for (const topic of coveredTopics) {
    const solution = findSolutionInNotes(topic.name, notesTexts);
    if (solution.confidence === 'low') {
      gaps.push(`"${topic.name}" is marked covered but has weak note coverage — add more notes.`);
    }
  }

  if (likelyQuestions.length === 0 && coveredTopics.length > 0) {
    for (const topic of coveredTopics.slice(0, 5)) {
      const solution = findSolutionInNotes(topic.name, notesTexts);
      likelyQuestions.push({
        question: `Explain the key concepts of ${topic.name} as they might appear in an exam.`,
        topic: topic.name,
        from_paper: 'Generated from syllabus',
        solution: solution.excerpt,
        note_source: solution.source,
        priority: 'medium',
        confidence: solution.confidence,
      });
    }
  }

  const coveragePct = unit.total_topics
    ? Math.round((unit.covered_topics / unit.total_topics) * 100)
    : 0;

  return {
    mode: 'rule-based',
    summary: `Analyzed ${papersWithText.length} past paper(s) against ${coveredTopics.length} covered topic(s) (${coveragePct}% syllabus complete). Found ${likelyQuestions.length} likely exam questions with note-based solutions.`,
    coverage: {
      total_topics: unit.total_topics || coveredTopics.length,
      covered_topics: unit.covered_topics || coveredTopics.length,
      percentage: coveragePct,
    },
    likely_questions: likelyQuestions.slice(0, 20),
    gaps: gaps.slice(0, 8),
    study_tips: [
      'Focus on high-priority questions where your notes have strong matches.',
      'Fill gaps by uploading more notes for weak topics before the exam.',
      'Practice answering predicted questions without looking at solutions first.',
      coveragePct < 70 ? 'Complete more syllabus topics before attempting full past papers.' : 'Good progress — drill the high-priority questions repeatedly.',
    ],
  };
}

async function analyzeUnit(unitId, paperId = null) {
  const unit = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM topics WHERE unit_id = u.id) AS total_topics,
      (SELECT COUNT(*) FROM topics WHERE unit_id = u.id AND is_covered = 1) AS covered_topics
    FROM units u WHERE u.id = ?
  `).get(unitId);

  if (!unit) throw new Error('Unit not found');

  const coveredTopics = db.prepare(`
    SELECT * FROM topics WHERE unit_id = ? AND is_covered = 1 ORDER BY sort_order, name
  `).all(unitId);

  if (coveredTopics.length === 0) {
    throw new Error('Mark at least one topic as covered before running exam prep analysis.');
  }

  let papers;
  if (paperId) {
    papers = db.prepare('SELECT * FROM past_papers WHERE id = ? AND unit_id = ?').all(paperId, unitId);
  } else {
    papers = db.prepare('SELECT * FROM past_papers WHERE unit_id = ? ORDER BY year DESC').all(unitId);
  }

  const notesTexts = await loadNotesTexts(unitId);
  if (notesTexts.length === 0) {
    throw new Error('Upload notes for this unit first — solutions are drawn from your notes.');
  }

  const papersWithText = [];
  for (const paper of papers) {
    const text = await loadPaperText(paper);
    if (text) papersWithText.push({ ...paper, text });
  }

  let analysis;
  const aiResult = await analyzeWithAI(unit, coveredTopics, notesTexts, papersWithText);
  if (aiResult) {
    analysis = {
      mode: 'ai',
      ...aiResult,
      coverage: {
        total_topics: unit.total_topics,
        covered_topics: unit.covered_topics,
        percentage: unit.total_topics
          ? Math.round((unit.covered_topics / unit.total_topics) * 100)
          : 0,
      },
    };
  } else {
    analysis = analyzeRuleBased(unit, coveredTopics, notesTexts, papersWithText);
  }

  analysis.meta = {
    unit_id: unitId,
    unit_name: unit.name,
    papers_analyzed: papersWithText.map((p) => ({ id: p.id, title: p.title, year: p.year })),
    notes_used: notesTexts.map((n) => n.title),
    analyzed_at: new Date().toISOString(),
  };

  const result = db.prepare(`
    INSERT INTO exam_analyses (unit_id, paper_id, analysis_json) VALUES (?, ?, ?)
  `).run(unitId, paperId || null, JSON.stringify(analysis));

  return { id: result.lastInsertRowid, ...analysis };
}

module.exports = { analyzeUnit };
