const db = require('../db');
const {
  extractQuestions,
  findSolutionForQuestion,
  inferTopicLabel,
  loadPaperText,
} = require('./examAnalyzer');
const { loadUnitNotesWithPages, findNotePageRefs, getQuiz, parsePageRange } = require('./noteAi');

function notesWithPagesToTexts(notesWithPages) {
  return notesWithPages.map((n) => ({
    id: n.id,
    title: n.title,
    text: n.text || (n.pages || []).map((p) => p.text).join('\n'),
  }));
}

function enrichNoteRefs(noteRefs, notesWithPages) {
  return noteRefs.map((ref) => {
    const note = notesWithPages.find((n) => n.id === ref.note_id);
    let excerpt = '';
    if (note?.pages?.length) {
      const pageNums = parsePageRange(ref.pages);
      const matchingPages = note.pages.filter((p) => pageNums.includes(p.page));
      excerpt = matchingPages.map((p) => p.text).join('\n\n').slice(0, 600);
    }
    return { ...ref, excerpt };
  });
}

async function analyzePaperForRevision(paperId, { noteIds = null } = {}) {
  const paper = await db.prepare('SELECT * FROM past_papers WHERE id = ?').get(paperId);
  if (!paper) throw new Error('Past paper not found');

  let notesWithPages = await loadUnitNotesWithPages(paper.unit_id);
  if (noteIds?.length) {
    const idSet = new Set(noteIds.map(Number));
    notesWithPages = notesWithPages.filter((n) => idSet.has(n.id));
  }

  if (notesWithPages.length === 0) {
    throw new Error('No notes available for this unit. Upload study notes first.');
  }

  const paperText = await loadPaperText(paper);
  if (!paperText) {
    throw new Error('Could not extract text from the past paper. Try a PDF or text-based file.');
  }

  const extracted = extractQuestions(paperText);
  const notesTexts = notesWithPagesToTexts(notesWithPages);

  await db.prepare('DELETE FROM paper_questions WHERE paper_id = ?').run(paperId);

  const insertQ = db.prepare(`
    INSERT INTO paper_questions (paper_id, unit_id, question_text, topic, solution_text, note_refs_json, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const results = [];
  for (let i = 0; i < extracted.length; i++) {
    const q = extracted[i];
    const solution = findSolutionForQuestion(q.raw, notesTexts);
    const noteRefs = enrichNoteRefs(
      findNotePageRefs(q.raw, notesWithPages),
      notesWithPages,
    );

    const questionText = q.raw.slice(0, 800);
    await insertQ.run(
      paperId,
      paper.unit_id,
      questionText,
      inferTopicLabel(q.raw),
      solution.excerpt,
      JSON.stringify(noteRefs),
      i,
    );

    results.push({
      question_text: questionText,
      topic: inferTopicLabel(q.raw),
      solution_text: solution.excerpt,
      note_references: noteRefs,
      note_source: solution.source,
      confidence: solution.confidence || (noteRefs.length > 0 ? 'medium' : 'low'),
    });
  }

  return {
    paper_id: paperId,
    paper_title: paper.title,
    question_count: results.length,
    questions: results,
    notes_used: notesWithPages.map((n) => ({ id: n.id, title: n.title })),
  };
}

async function getPaperQuestions(paperId) {
  const paper = await db.prepare(`
    SELECT p.*, u.name AS unit_name
    FROM past_papers p JOIN units u ON p.unit_id = u.id
    WHERE p.id = ?
  `).get(paperId);
  if (!paper) return null;

  const questions = (await db.prepare(`
    SELECT * FROM paper_questions WHERE paper_id = ? ORDER BY sort_order
  `).all(paperId)).map((q) => ({
    ...q,
    note_references: q.note_refs_json ? JSON.parse(q.note_refs_json) : [],
    note_refs_json: undefined,
  }));

  return { paper, questions, question_count: questions.length };
}

async function createQuizFromPaper(paperId) {
  const data = await getPaperQuestions(paperId);
  if (!data) throw new Error('Past paper not found');
  if (data.questions.length === 0) {
    throw new Error('No revision questions found. Run analysis on this paper first.');
  }

  const paper = data.paper;
  const firstNote = await db.prepare('SELECT id FROM notes WHERE unit_id = ? ORDER BY id LIMIT 1').get(paper.unit_id);
  if (!firstNote) throw new Error('No notes found for this unit.');

  const noteId = data.questions
    .flatMap((q) => q.note_references)
    .find((r) => r.note_id)?.note_id || firstNote.id;

  const title = `Revision: ${paper.title}`;
  const quizResult = await db.prepare(`
    INSERT INTO quizzes (note_id, unit_id, title) VALUES (?, ?, ?)
  `).run(noteId, paper.unit_id, title);

  const quizId = quizResult.lastInsertRowid;
  const insertQ = db.prepare(`
    INSERT INTO quiz_questions (quiz_id, question_text, question_type, options_json, correct_answer, topic, sort_order, source_paper, note_refs_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sourcePaper = `${paper.title}${paper.year ? ` (${paper.year})` : ''}`;
  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    await insertQ.run(
      quizId,
      q.question_text,
      'short',
      null,
      q.solution_text || 'Refer to your notes',
      q.topic || 'General',
      i,
      sourcePaper,
      JSON.stringify(q.note_references || []),
    );
  }

  return getQuiz(quizId);
}

module.exports = {
  analyzePaperForRevision,
  getPaperQuestions,
  createQuizFromPaper,
};
