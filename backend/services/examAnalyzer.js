const db = require('../db');
const storage = require('./storage');
const { extractText, normalizeText, splitIntoChunks } = require('./textExtractor');
const { chatJSON, isAIConfigured, getLastAIError } = require('./openai');
const { loadUnitNotesWithPages, findNotePageRefs } = require('./noteAi');

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
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

function findSolutionForQuestion(questionText, notesTexts) {
  const keywords = [...new Set(tokenize(questionText))].filter((k) => k.length > 3);
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
      excerpt: 'No direct match in your selected notes. Review the related section in your notes or add more detail.',
      source: null,
      confidence: 'low',
    };
  }

  return {
    excerpt: best.excerpt,
    source: best.source,
    confidence: best.score >= 3 ? 'high' : best.score >= 1 ? 'medium' : 'low',
  };
}

function inferTopicLabel(questionText) {
  const words = tokenize(questionText).filter((w) => w.length > 4);
  return words.slice(0, 3).join(' ') || 'General';
}

async function loadNotesTexts(unitId, noteIds) {
  if (!noteIds?.length) return [];

  const placeholders = noteIds.map(() => '?').join(',');
  const notes = await db.prepare(`
    SELECT * FROM notes WHERE unit_id = ? AND id IN (${placeholders})
  `).all(unitId, ...noteIds);

  const results = [];
  for (const note of notes) {
    try {
      const filePath = await storage.getReadablePath(storage.BUCKETS.NOTES, note.filename);
      const text = normalizeText(await extractText(filePath));
      if (text) results.push({ id: note.id, title: note.title, text });
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

async function loadPaperText(paper) {
  const filePath = await storage.getReadablePath(storage.BUCKETS.PAPERS, paper.filename);
  return normalizeText(await extractText(filePath));
}

async function analyzeWithAI(unit, notesTexts, papersWithText) {
  if (!isAIConfigured()) return null;

  const prompt = `You are a study assistant preparing a student for exams in "${unit.name}".

STUDY NOTES (use ONLY these notes for solutions — cite the note title):
${notesTexts.map((n) => `[${n.title}]:\n${n.text.slice(0, 2500)}`).join('\n\n')}

PAST EXAM PAPERS (extract real exam questions from these):
${papersWithText.map((p) => `[${p.title}${p.year ? ` (${p.year})` : ''}]:\n${p.text.slice(0, 2500)}`).join('\n\n')}

Tasks:
1. Find exam-style questions from the past papers (use the actual question wording where possible).
2. For each question, write a detailed solution using ONLY the study notes above.
3. Flag topics that appear in papers but are weak or missing in the selected notes.

Return JSON only with this shape:
{
  "summary": "brief exam prep advice",
  "likely_questions": [
    {
      "question": "question text from the paper",
      "topic": "short topic label",
      "from_paper": "paper title",
      "solution": "detailed answer drawn from the notes",
      "note_source": "note title used for the solution",
      "note_references": [{ "note_title": "note title", "pages": "12-14" }],
      "priority": "high|medium|low"
    }
  ],
  "gaps": ["areas weak or missing in the selected notes"],
  "study_tips": ["actionable tip"]
}`;

  const result = await chatJSON(prompt);
  if (!result && isAIConfigured()) {
    console.warn('Exam prep AI failed:', getLastAIError());
  }
  return result;
}

function analyzeRuleBased(unit, notesTexts, papersWithText, notesWithPages = []) {
  const likelyQuestions = [];
  const gaps = [];
  const seen = new Set();

  for (const paper of papersWithText) {
    const questions = extractQuestions(paper.text);

    for (const q of questions) {
      const key = q.raw.slice(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);

      const solution = findSolutionForQuestion(q.raw, notesTexts);
      const noteRefs = notesWithPages.length
        ? findNotePageRefs(q.raw, notesWithPages)
        : [];

      likelyQuestions.push({
        question: q.raw.slice(0, 500),
        topic: inferTopicLabel(q.raw),
        from_paper: paper.title,
        solution: solution.excerpt,
        note_source: solution.source,
        note_references: noteRefs,
        priority: solution.confidence === 'high' ? 'high' : solution.confidence === 'medium' ? 'medium' : 'low',
        confidence: solution.confidence,
      });
    }
  }

  const lowConfidence = likelyQuestions.filter((q) => q.confidence === 'low').length;
  if (lowConfidence > 0) {
    gaps.push(`${lowConfidence} question(s) had weak matches in your selected notes — consider adding or selecting more notes.`);
  }

  if (likelyQuestions.length === 0 && papersWithText.length > 0) {
    gaps.push('Could not extract clear questions from the past papers. Try uploading clearer PDF or text papers.');
  }

  return {
    mode: 'rule-based',
    summary: `Analyzed ${papersWithText.length} past paper(s) using ${notesTexts.length} selected note(s). Found ${likelyQuestions.length} exam questions with note-based solutions.`,
    likely_questions: likelyQuestions.slice(0, 25),
    gaps: gaps.slice(0, 8),
    study_tips: [
      'Practice answering each predicted question without looking at the solution first.',
      'Focus on high-priority questions that matched strongly with your notes.',
      lowConfidence > 0 ? 'Select more notes or upload additional material for weak matches.' : 'Good note coverage — drill the high-priority questions repeatedly.',
      papersWithText.length === 0 ? 'Upload past papers to get real exam questions.' : 'Compare your answers against the note-based solutions.',
    ],
  };
}

async function analyzeUnit(unitId, { paperId = null, noteIds = [] } = {}) {
  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
  if (!unit) throw new Error('Unit not found');

  if (!noteIds.length) {
    throw new Error('Select at least one note to use for exam prep.');
  }

  const notesTexts = await loadNotesTexts(unitId, noteIds);
  if (notesTexts.length === 0) {
    throw new Error('Could not read text from the selected notes. Try PDF, DOCX, PPT, PPTX, TXT, or MD files.');
  }

  let notesWithPages = await loadUnitNotesWithPages(unitId);
  const noteIdSet = new Set(noteIds.map(Number));
  notesWithPages = notesWithPages.filter((n) => noteIdSet.has(n.id));

  let papers;
  if (paperId) {
    papers = await db.prepare('SELECT * FROM past_papers WHERE id = ? AND unit_id = ?').all(paperId, unitId);
  } else {
    papers = await db.prepare('SELECT * FROM past_papers WHERE unit_id = ? ORDER BY year DESC').all(unitId);
  }

  if (papers.length === 0) {
    throw new Error('Upload past papers for this unit first — questions are extracted from them.');
  }

  const papersWithText = [];
  for (const paper of papers) {
    const text = await loadPaperText(paper);
    if (text) papersWithText.push({ ...paper, text });
  }

  if (papersWithText.length === 0) {
    throw new Error('Could not extract text from the past papers. Try PDF or text-based files.');
  }

  let analysis;
  const aiResult = await analyzeWithAI(unit, notesTexts, papersWithText);
  if (aiResult) {
    analysis = {
      mode: 'ai',
      ...aiResult,
      likely_questions: (aiResult.likely_questions || []).map((q) => ({
        ...q,
        note_references: q.note_references?.length
          ? q.note_references
          : findNotePageRefs(`${q.question} ${q.solution}`, notesWithPages),
      })),
    };
  } else {
    analysis = analyzeRuleBased(unit, notesTexts, papersWithText, notesWithPages);
  }

  analysis.meta = {
    unit_id: unitId,
    unit_name: unit.name,
    note_ids: noteIds,
    papers_analyzed: papersWithText.map((p) => ({ id: p.id, title: p.title, year: p.year })),
    notes_used: notesTexts.map((n) => ({ id: n.id, title: n.title })),
    analyzed_at: new Date().toISOString(),
  };

  const result = await db.prepare(`
    INSERT INTO exam_analyses (unit_id, paper_id, analysis_json) VALUES (?, ?, ?)
  `).run(unitId, paperId || null, JSON.stringify(analysis));

  return { id: result.lastInsertRowid, ...analysis };
}

module.exports = {
  analyzeUnit,
  extractQuestions,
  findSolutionForQuestion,
  inferTopicLabel,
  loadNotesTexts,
  loadPaperText,
};
