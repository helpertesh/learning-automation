import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Brain, CheckCircle, XCircle, ArrowLeft, AlertTriangle, Timer, Sparkles, BookOpen, FileText,
} from 'lucide-react';
import { api } from '../api/client';

function NoteReferences({ refs, onViewNote }) {
  if (!refs?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <BookOpen size={12} className="text-indigo-400 shrink-0" />
      {refs.map((ref, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onViewNote?.(ref)}
          className="rounded bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300 hover:bg-indigo-500/20"
        >
          {ref.note_title} — p.{ref.pages}
        </button>
      ))}
    </div>
  );
}

export default function QuizPage() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [noteExcerpt, setNoteExcerpt] = useState(null);

  useEffect(() => {
    api.quizzes.get(id)
      .then(setQuiz)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleViewNote = async (ref) => {
    if (!ref.note_id) return;
    const pages = String(ref.pages || '1');
    const firstPage = pages.includes('-') ? pages.split('-')[0].trim() : pages.split(',')[0].trim();
    const lastPage = pages.includes('-') ? pages.split('-')[1].trim() : firstPage;
    try {
      const excerpt = await api.notes.getPages(ref.note_id, firstPage, lastPage);
      setNoteExcerpt(excerpt);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = quiz.questions.map((q) => ({
      question_id: q.id,
      answer: answers[q.id] || '',
    }));

    const unanswered = payload.filter((a) => !a.answer.trim());
    if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) unanswered. Submit anyway?`)) return;

    setSubmitting(true);
    try {
      const res = await api.quizzes.submit(id, payload);
      setResult(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!quiz) {
    return <p className="text-slate-500">Quiz not found.</p>;
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/past-papers" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Back to Past Papers
        </Link>

        <div className="card p-6 text-center">
          <Brain size={40} className="mx-auto text-purple-400" />
          <h1 className="mt-4 text-2xl font-bold text-white">Quiz Complete</h1>
          <p className="mt-2 text-4xl font-bold text-indigo-400">{result.percentage}%</p>
          <p className="text-slate-500">{result.score} / {result.total} correct</p>
          <p className="mt-1 text-xs text-slate-600">Graded with {result.mode === 'ai' ? 'AI' : 'smart matching'}</p>
        </div>

        {result.weak_topics?.length > 0 && (
          <div className="card border-amber-500/20 bg-amber-500/5 p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-400">
              <AlertTriangle size={18} /> Weak Topics Found
            </h2>
            <div className="space-y-2">
              {result.weak_topics.map(({ topic, count }) => (
                <div key={topic} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                  <span className="text-sm text-white">{topic}</span>
                  <span className="text-xs text-amber-400">{count} missed</span>
                </div>
              ))}
            </div>
            {result.study_sessions_created?.length > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3">
                <Timer size={16} className="mt-0.5 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-300">
                  {result.study_sessions_created.length} review session(s) created (30 min each) for weak topics.
                  <Link to="/study" className="ml-1 underline">View Study Log</Link>
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <h2 className="font-semibold text-white">Review Answers</h2>
          {result.results.map((r, i) => (
            <div key={r.question_id} className={`card p-4 ${r.is_correct ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
              <div className="flex items-start gap-2">
                {r.is_correct
                  ? <CheckCircle size={18} className="mt-0.5 text-emerald-400 shrink-0" />
                  : <XCircle size={18} className="mt-0.5 text-red-400 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Q{i + 1}. {r.question}</p>
                  {r.topic && <p className="mt-1 text-xs text-slate-500">Topic: {r.topic}</p>}
                  {r.source_paper && (
                    <p className="mt-1 text-xs text-purple-400">From past paper: {r.source_paper}</p>
                  )}
                  <NoteReferences refs={r.note_references} onViewNote={handleViewNote} />
                  <p className="mt-2 text-sm text-slate-400">Your answer: {r.user_answer || '(blank)'}</p>
                  {!r.is_correct && (
                    <p className="mt-1 text-sm text-emerald-400">Correct: {r.correct_answer}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">{r.feedback}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {noteExcerpt && (
          <div className="card border-indigo-500/30 bg-indigo-500/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-indigo-300">
                {noteExcerpt.note_title} — pages {noteExcerpt.from}{noteExcerpt.to !== noteExcerpt.from ? `–${noteExcerpt.to}` : ''}
              </p>
              <button type="button" onClick={() => setNoteExcerpt(null)} className="text-xs text-slate-500 hover:text-white">Close</button>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">{noteExcerpt.excerpt}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setResult(null); setAnswers({}); setNoteExcerpt(null); }} className="btn-secondary">
            Retake Quiz
          </button>
          <Link to="/past-papers" className="btn-primary">Back to Past Papers</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/past-papers" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={16} /> Back to Past Papers
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">{quiz.title}</h1>
        <p className="mt-1 text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: quiz.unit_color }} />
          {quiz.unit_name} &middot; From: {quiz.note_title} &middot; {quiz.questions.length} questions
        </p>
      </div>

      <div className="card border-purple-500/20 bg-purple-500/5 p-3 flex items-center gap-2">
        <Sparkles size={16} className="text-purple-400" />
        <p className="text-sm text-purple-300">
          Revision quiz from your exam paper. Click note references to read the relevant pages while you answer.
        </p>
      </div>

      {noteExcerpt && (
        <div className="card border-indigo-500/30 bg-indigo-500/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-indigo-300">
              {noteExcerpt.note_title} — pages {noteExcerpt.from}{noteExcerpt.to !== noteExcerpt.from ? `–${noteExcerpt.to}` : ''}
            </p>
            <button type="button" onClick={() => setNoteExcerpt(null)} className="text-xs text-slate-500 hover:text-white">Close</button>
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">{noteExcerpt.excerpt}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="card p-5">
            <p className="font-medium text-white">
              <span className="text-indigo-400 mr-2">Q{i + 1}.</span>
              {q.question_text}
            </p>
            {q.topic && <p className="mt-1 text-xs text-slate-500">Topic: {q.topic}</p>}
            {q.source_paper && (
              <p className="mt-1 flex items-center gap-1 text-xs text-purple-400">
                <FileText size={11} /> From: {q.source_paper}
              </p>
            )}
            <NoteReferences refs={q.note_references} onViewNote={handleViewNote} />

            <textarea
              className="input mt-3 min-h-[120px]"
              placeholder="Type your answer..."
              value={answers[q.id] || ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          </div>
        ))}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Marking with AI...' : 'Submit Quiz'}
        </button>
      </form>
    </div>
  );
}
