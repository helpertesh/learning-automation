const path = require('path');
const db = require('../db');
const { extractText, extractTextWithPages, normalizeText, splitIntoChunks } = require('./textExtractor');
const {
  filterSubstantiveChunks,
  filterSubstantivePages,
  isLowQualityQuizQuestion,
  buildSubstantiveTextFromPages,
} = require('./contentFilter');
const { chatJSON, isAIConfigured, getLastAIError } = require('./openai');

function requireAIResult(result, action) {
  if (result) return result;
  if (isAIConfigured()) {
    throw new Error(`AI ${action} failed: ${getLastAIError() || 'unknown error'}. Check your API key and billing.`);
  }
  return null;
}

const NOTES_DIR = path.join(__dirname, '..', 'uploads', 'notes');
const PAPERS_DIR = path.join(__dirname, '..', 'uploads', 'past-papers');
async function notifyN8n(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.warn('n8n webhook failed:', err.message);
  }
}

async function loadNoteText(note) {
  const filePath = path.join(NOTES_DIR, note.filename);
  const text = normalizeText(await extractText(filePath));
  if (!text) {
    throw new Error('Could not extract text from this file. Try PDF, DOCX, PPTX, TXT, or MD.');
  }
  return text;
}

async function loadNoteWithPages(note) {
  const filePath = path.join(NOTES_DIR, note.filename);
  const extracted = await extractTextWithPages(filePath);
  if (!extracted.text) {
    throw new Error('Could not extract text from this file. Try PDF, DOCX, PPTX, TXT, or MD.');
  }
  return { ...note, ...extracted };
}

async function loadUnitNotesWithPages(unitId) {
  const notes = db.prepare('SELECT * FROM notes WHERE unit_id = ?').all(unitId);
  const results = [];
  for (const note of notes) {
    try {
      results.push(await loadNoteWithPages(note));
    } catch {
      // skip unreadable
    }
  }
  return results;
}

async function loadUnitPastPapers(unitId) {
  const papers = db.prepare(`
    SELECT * FROM past_papers WHERE unit_id = ? ORDER BY year DESC, created_at DESC
  `).all(unitId);
  const results = [];
  for (const paper of papers) {
    const filePath = path.join(PAPERS_DIR, paper.filename);
    try {
      const extracted = await extractTextWithPages(filePath);
      if (extracted.text) results.push({ ...paper, ...extracted });
    } catch {
      // skip unreadable
    }
  }
  return results;
}

function formatPageRange(pages) {
  if (!pages.length) return '';
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 1) return String(sorted[0]);

  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? String(start) : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? String(start) : `${start}-${end}`);
  return ranges.join(', ');
}

function findNotePageRefs(searchText, notesWithPages) {
  const keywords = (searchText || '').toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  if (keywords.length === 0) return [];

  const refs = [];
  for (const note of notesWithPages) {
    const matchingPages = [];
    for (const pg of note.pages || []) {
      const lower = pg.text.toLowerCase();
      const hits = keywords.filter((k) => lower.includes(k)).length;
      if (hits >= Math.max(2, Math.ceil(keywords.length * 0.12))) {
        matchingPages.push(pg.page);
      }
    }
    if (matchingPages.length > 0) {
      refs.push({
        note_id: note.id,
        note_title: note.title,
        pages: formatPageRange(matchingPages.slice(0, 5)),
      });
    }
  }
  return refs;
}

function buildNotesPromptSection(notesWithPages, maxPagesPerNote = 12) {
  return notesWithPages.map((note) => {
    const substantive = filterSubstantivePages(note.pages || [], { skipFirst: 2 })
      .slice(0, maxPagesPerNote);
    if (!substantive.length) return '';

    return substantive.map((pg) =>
      `[${note.title}, Page ${pg.page}]: ${pg.text.slice(0, 700)}`,
    ).join('\n');
  }).filter(Boolean).join('\n\n');
}

function extractPaperQuestions(paperText) {
  const lines = paperText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const questions = [];
  const questionStart = /^((?:question|q)\s*[\d]+[.):\-]?|(?:\d+)[.)]\s+)/i;

  for (const line of lines) {
    if (questionStart.test(line)) {
      questions.push(line.slice(0, 400));
    }
  }

  if (questions.length === 0) {
    return splitIntoChunks(normalizeText(paperText), 350).slice(0, 8);
  }
  return questions.slice(0, 10);
}

function normalizeShortAnswerQuestion(q) {
  return {
    ...q,
    type: 'short',
    options: undefined,
  };
}

function buildPastPapersPromptSection(papers) {
  return papers.map((p) => {
    const questions = extractPaperQuestions(p.text);
    const yearLabel = p.year ? ` (${p.year})` : '';
    return `[Past Paper: ${p.title}${yearLabel}]\nQuestions/excerpts:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
  }).join('\n\n');
}
async function summarizeNote(noteId) {
  const note = db.prepare(`
    SELECT n.*, u.name AS unit_name FROM notes n
    JOIN units u ON n.unit_id = u.id WHERE n.id = ?
  `).get(noteId);
  if (!note) throw new Error('Note not found');

  const noteWithPages = await loadNoteWithPages(note);
  const substantiveText = buildSubstantiveTextFromPages(noteWithPages.pages, 28000)
    || noteWithPages.text.slice(0, 28000);

  let aiResult = await chatJSON(`You are an expert study assistant. Create a COMPREHENSIVE study summary from these notes for "${note.title}" (${note.unit_name}).

RULES:
- IGNORE: table of contents, chapter lists, page numbers, titles, preface, index, copyright, headers/footers
- FOCUS ON: definitions, concepts, explanations, examples, formulas, processes, and exam-relevant facts
- Write a DETAILED summary a student can revise from — not a brief overview

NOTES (substantive content only):
${substantiveText}

Return JSON:
{
  "summary": "Detailed multi-section summary in plain text. Use sections like: Overview, Key Concepts, Important Details, Examples & Applications, Exam Tips. Write at least 5-8 substantial paragraphs covering ALL major topics in the notes.",
  "key_points": ["12-20 bullet points of specific facts, definitions, and concepts the student must remember — no chapter titles or TOC items"]
}`, { temperature: 0.4 });

  aiResult = requireAIResult(aiResult, 'summary');

  let summary;
  let keyPoints;

  if (aiResult?.summary) {
    summary = aiResult.summary;
    keyPoints = (aiResult.key_points || []).filter((p) => p && p.length > 15);
  } else {
    const chunks = filterSubstantiveChunks(splitIntoChunks(noteWithPages.text, 400)).slice(0, 12);
    summary = chunks.slice(0, 6).join('\n\n');
    keyPoints = chunks.map((c) => c.slice(0, 150));
  }

  const existing = db.prepare('SELECT id FROM note_summaries WHERE note_id = ?').get(noteId);
  if (existing) {
    db.prepare(`
      UPDATE note_summaries SET summary_text = ?, key_points_json = ?, created_at = datetime('now')
      WHERE note_id = ?
    `).run(summary, JSON.stringify(keyPoints), noteId);
  } else {
    db.prepare(`
      INSERT INTO note_summaries (note_id, summary_text, key_points_json) VALUES (?, ?, ?)
    `).run(noteId, summary, JSON.stringify(keyPoints));
  }

  return {
    note_id: noteId,
    summary,
    key_points: keyPoints,
    mode: aiResult ? 'ai' : 'rule-based',
  };
}

async function generateQuiz(noteId) {
  const note = db.prepare(`
    SELECT n.*, u.name AS unit_name FROM notes n
    JOIN units u ON n.unit_id = u.id WHERE n.id = ?
  `).get(noteId);
  if (!note) throw new Error('Note not found');

  const notesWithPages = await loadUnitNotesWithPages(note.unit_id);
  const primaryNote = notesWithPages.find((n) => n.id === noteId) || notesWithPages[0];
  if (!primaryNote) throw new Error('Could not read note content. Use PDF, TXT, or MD.');

  const pastPapers = await loadUnitPastPapers(note.unit_id);
  const summaryRow = db.prepare('SELECT * FROM note_summaries WHERE note_id = ?').get(noteId);

  const notesSection = buildNotesPromptSection(notesWithPages);
  const papersSection = pastPapers.length > 0 ? buildPastPapersPromptSection(pastPapers) : '';

  let aiResult = await chatJSON(`Generate an exam-style quiz for "${note.title}" in unit "${note.unit_name}".

CRITICAL — DO NOT ask questions about:
- Table of contents, chapter lists, section headings, or document structure
- Page numbers, "what is on page X", or navigation of the document
- Author, publisher, ISBN, copyright, preface, or bibliography
- Listing or naming chapters/units/modules

ONLY ask questions about SUBSTANTIVE LEARNING CONTENT:
- Definitions, concepts, theories, processes, formulas, examples
- Application and problem-solving (exam-style)
- Compare/contrast, explain why, calculate, analyze

OTHER RULES:
1. Base questions primarily on PAST EXAM PAPERS when available — match their style and difficulty
2. Answers must come from the student's NOTES (not invented facts)
3. For EVERY question, include note_references with exact page numbers for the answer

${summaryRow ? `SUMMARY OF PRIMARY NOTE:\n${summaryRow.summary_text.slice(0, 4000)}\n\n` : ''}

${papersSection ? `PAST EXAM PAPERS:\n${papersSection.slice(0, 8000)}\n\n` : 'No past papers uploaded — generate exam-style questions from substantive note content only.\n\n'}

STUDENT NOTES (substantive pages only — skip TOC/front matter):
${notesSection.slice(0, 14000)}

Return JSON:
{
  "title": "Quiz title",
  "questions": [
    {
      "question": "university-style written exam question (explain, define, compare, calculate, analyze, discuss)",
      "type": "short",
      "correct_answer": "detailed model answer from notes (2-5 sentences)",
      "topic": "specific concept name (not chapter number)",
      "source_paper": "Past paper title + year, or Notes only",
      "note_references": [{ "note_title": "note filename", "pages": "12-14" }]
    }
  ]
}

Generate 6-8 written-answer questions ONLY. No multiple choice. No true/false. University exam style — student types full answers. At least half inspired by past papers when available. Zero TOC/structure questions.`, { temperature: 0.35 });

  aiResult = requireAIResult(aiResult, 'quiz generation');

  let questions;
  let title;

  if (aiResult?.questions?.length) {
    title = aiResult.title || `Quiz: ${note.title}`;
    questions = aiResult.questions
      .filter((q) => !isLowQualityQuizQuestion(q))
      .map((q) => normalizeShortAnswerQuestion({
        ...q,
        note_references: q.note_references?.length
          ? q.note_references
          : findNotePageRefs(`${q.question} ${q.correct_answer}`, notesWithPages),
      }));

    if (questions.length < 3) {
      throw new Error('AI generated too many low-quality questions. Try re-summarizing the note first, then generate quiz again.');
    }
  } else {
    title = pastPapers.length > 0
      ? `Past Paper Quiz: ${note.title}`
      : `Quiz: ${note.title}`;

    questions = [];

    if (pastPapers.length > 0) {
      for (const paper of pastPapers.slice(0, 2)) {
        const paperQuestions = extractPaperQuestions(p.text);
        for (const [i, pq] of paperQuestions.slice(0, 4).entries()) {
          const refs = findNotePageRefs(pq, notesWithPages);
          const answerChunk = refs.length > 0
            ? (notesWithPages.find((n) => n.id === refs[0].note_id)?.pages
              ?.find((pg) => refs[0].pages.startsWith(String(pg.page)))?.text || '').slice(0, 200)
            : primaryNote.text.slice(0, 200);

          questions.push(normalizeShortAnswerQuestion({
            question: pq.startsWith('Explain') || pq.startsWith('Define') || pq.startsWith('Discuss')
              ? pq
              : `Explain: ${pq}`,
            correct_answer: answerChunk || 'Refer to your notes',
            topic: pq.split(' ').slice(0, 4).join(' '),
            source_paper: `${paper.title}${paper.year ? ` (${paper.year})` : ''}`,
            note_references: refs,
          }));
        }
      }
      questions = questions.filter((q) => !isLowQualityQuizQuestion(q)).slice(0, 8);
    }

    if (questions.length === 0) {
      const chunks = filterSubstantiveChunks(splitIntoChunks(primaryNote.text, 350)).slice(0, 6);
      questions = chunks.map((chunk, i) => {
        const refs = findNotePageRefs(chunk, notesWithPages);
        return normalizeShortAnswerQuestion({
          question: `Explain the following in detail: "${chunk.slice(0, 120)}..."`,
          correct_answer: chunk.slice(0, 400),
          topic: chunk.split(' ').slice(0, 3).join(' ') || 'General',
          source_paper: 'Notes only',
          note_references: refs.length ? refs : [{ note_title: note.title, pages: '1' }],
        });
      });
    }
  }

  const quizResult = db.prepare(`
    INSERT INTO quizzes (note_id, unit_id, title) VALUES (?, ?, ?)
  `).run(noteId, note.unit_id, title);

  const quizId = quizResult.lastInsertRowid;
  const insertQ = db.prepare(`
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, correct_answer, topic, sort_order, source_paper, note_refs_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  questions.forEach((q, i) => {
    const normalized = normalizeShortAnswerQuestion(q);
    insertQ.run(
      quizId,
      normalized.question,
      'short',
      null,
      normalized.correct_answer,
      normalized.topic || 'General',
      i,
      normalized.source_paper || null,
      JSON.stringify(normalized.note_references || []),
    );
  });

  return getQuiz(quizId);
}
function getQuiz(quizId) {
  const quiz = db.prepare(`
    SELECT q.*, n.title AS note_title, u.name AS unit_name, u.color AS unit_color
    FROM quizzes q
    JOIN notes n ON q.note_id = n.id
    JOIN units u ON q.unit_id = u.id
    WHERE q.id = ?
  `).get(quizId);
  if (!quiz) return null;

  const questions = db.prepare(`
    SELECT id, question_text, question_type, options_json, topic, sort_order, source_paper, note_refs_json
    FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order
  `).all(quizId).map((q) => ({
    ...q,
    options: q.options_json ? JSON.parse(q.options_json) : null,
    note_references: q.note_refs_json ? JSON.parse(q.note_refs_json) : [],
    options_json: undefined,
    note_refs_json: undefined,
  }));
  return { ...quiz, questions };
}

async function markQuiz(quizId, answers) {
  const quiz = getQuiz(quizId);
  if (!quiz) throw new Error('Quiz not found');

  const attemptResult = db.prepare(`
    INSERT INTO quiz_attempts (quiz_id, started_at) VALUES (?, datetime('now'))
  `).run(quizId);
  const attemptId = attemptResult.lastInsertRowid;

  let score = 0;
  const results = [];
  const weakTopics = {};

  for (const question of quiz.questions) {
    const userAnswer = answers.find((a) => a.question_id === question.id)?.answer || '';
    const fullQ = db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(question.id);

    let isCorrect = false;
    let feedback = '';
    let points = 0;

    const aiMark = await chatJSON(`Grade this university-style written exam answer.

Question: ${fullQ.question_text}
Model answer: ${fullQ.correct_answer}
Student answer: ${userAnswer}

Be fair: accept paraphrasing and partial credit if key concepts are covered.
Return JSON: { "is_correct": true/false, "score": 0-1, "feedback": "brief constructive feedback" }`);

    if (aiMark) {
      isCorrect = !!aiMark.is_correct;
      points = aiMark.score >= 0.5 ? 1 : 0;
      feedback = aiMark.feedback;
    } else {
      const keywords = fullQ.correct_answer.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
      const userLower = userAnswer.toLowerCase();
      const hits = keywords.filter((k) => userLower.includes(k)).length;
      isCorrect = hits >= Math.max(1, Math.ceil(keywords.length * 0.3));
      points = isCorrect ? 1 : 0;
      feedback = isCorrect
        ? 'Good answer — key concepts covered.'
        : `Review this topic. Expected: ${fullQ.correct_answer.slice(0, 200)}`;
    }

    const noteRefs = fullQ.note_refs_json ? JSON.parse(fullQ.note_refs_json) : [];
    if (!isCorrect && noteRefs.length > 0) {
      const refHint = noteRefs.map((r) => `${r.note_title} p.${r.pages}`).join(', ');
      feedback += ` Refer to: ${refHint}`;
    }

    if (!isCorrect) {
      const topic = fullQ.topic || 'General';
      weakTopics[topic] = (weakTopics[topic] || 0) + 1;
    }

    score += points;
    db.prepare(`
      INSERT INTO quiz_answers (attempt_id, question_id, user_answer, is_correct, ai_feedback, score)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(attemptId, question.id, userAnswer, isCorrect ? 1 : 0, feedback, points);

    results.push({
      question_id: question.id,
      question: question.question_text,
      topic: fullQ.topic,
      source_paper: fullQ.source_paper,
      note_references: noteRefs,
      user_answer: userAnswer,
      is_correct: isCorrect,
      feedback,
      correct_answer: fullQ.correct_answer,
    });
  }

  const total = quiz.questions.length;
  const weakTopicsList = Object.entries(weakTopics).map(([topic, count]) => ({ topic, count }));

  db.prepare(`
    UPDATE quiz_attempts SET score = ?, total = ?, weak_topics_json = ?, completed_at = datetime('now')
    WHERE id = ?
  `).run(score, total, JSON.stringify(weakTopicsList), attemptId);

  for (const { topic, count } of weakTopicsList) {
    const existing = db.prepare(`
      SELECT id, weakness_score FROM topic_weakness WHERE unit_id = ? AND topic_name = ?
    `).get(quiz.unit_id, topic);

    if (existing) {
      db.prepare(`
        UPDATE topic_weakness SET weakness_score = weakness_score + ?, last_assessed_at = datetime('now'), source = 'quiz'
        WHERE id = ?
      `).run(count, existing.id);
    } else {
      db.prepare(`
        INSERT INTO topic_weakness (unit_id, topic_name, weakness_score, source) VALUES (?, ?, ?, 'quiz')
      `).run(quiz.unit_id, topic, count);
    }
  }

  const studySessions = [];
  for (const { topic } of weakTopicsList) {
    const sessionResult = db.prepare(`
      INSERT INTO study_sessions (unit_id, duration_minutes, notes, topic_name, session_type)
      VALUES (?, 30, ?, ?, 'weak_topic_review')
    `).run(
      quiz.unit_id,
      `Review weak topic from quiz: ${topic}`,
      topic,
    );
    studySessions.push({ id: sessionResult.lastInsertRowid, topic, duration_minutes: 30 });
  }

  notifyN8n({
    event: 'quiz_completed',
    quiz_id: quizId,
    unit_id: quiz.unit_id,
    unit_name: quiz.unit_name,
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    weak_topics: weakTopicsList,
    study_sessions: studySessions,
  });

  const { sendQuizWhatsApp } = require('./studyDigest');
  sendQuizWhatsApp({
    quiz_id: quizId,
    attempt_id: attemptId,
    quiz_title: quiz.title,
    unit_name: quiz.unit_name,
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    weak_topics: weakTopicsList,
  }).catch((err) => console.warn('WhatsApp quiz notify:', err.message));

  return {
    attempt_id: attemptId,
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    results,
    weak_topics: weakTopicsList,
    study_sessions_created: studySessions,
    mode: process.env.OPENAI_API_KEY ? 'ai' : 'rule-based',
  };
}

function getNoteSummary(noteId) {
  const row = db.prepare('SELECT * FROM note_summaries WHERE note_id = ?').get(noteId);
  if (!row) return null;
  return {
    note_id: noteId,
    summary: row.summary_text,
    key_points: JSON.parse(row.key_points_json || '[]'),
    created_at: row.created_at,
  };
}

module.exports = { summarizeNote, generateQuiz, getQuiz, markQuiz, getNoteSummary };
