import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Plus, Download, Trash2, Sparkles, Brain, ChevronDown, ChevronUp, HelpCircle,
} from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import FileUpload from '../components/FileUpload';
import { formatDateTime } from '../utils/dates';

function NoteCard({ note, onRefresh, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const loadMeta = async () => {
    setLoadingMeta(true);
    try {
      const [s, q] = await Promise.allSettled([
        api.notes.getSummary(note.id),
        api.notes.getQuizzes(note.id),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value);
      if (q.status === 'fulfilled') setQuizzes(q.value);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (expanded && !loadingMeta) loadMeta();
  }, [expanded]);

  const handleSummarize = async () => {
    setLoadingSummary(true);
    try {
      const result = await api.notes.summarize(note.id);
      setSummary(result);
      setExpanded(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setLoadingQuiz(true);
    try {
      const quiz = await api.quizzes.generate(note.id);
      setQuizzes((prev) => [quiz, ...prev]);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingQuiz(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <FileText size={18} className="text-indigo-400" />
          </div>
          <div>
            <p className="font-medium text-white">{note.title}</p>
            <p className="text-xs text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: note.unit_color }} />
              {note.unit_name} &middot; {formatDateTime(note.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSummarize}
            disabled={loadingSummary}
            className="rounded-lg px-2 py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50"
            title="Create Summary"
          >
            <Sparkles size={14} className="inline mr-1" />
            {loadingSummary ? 'Summarizing...' : summary ? 'Re-summarize' : 'Summary'}
          </button>
          <button
            onClick={handleGenerateQuiz}
            disabled={loadingQuiz}
            className="rounded-lg px-2 py-1.5 text-xs text-purple-400 hover:bg-purple-500/10 disabled:opacity-50"
            title="Generate Quiz"
          >
            <Brain size={14} className="inline mr-1" />
            {loadingQuiz ? 'Generating...' : 'Quiz'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <a href={api.notes.downloadUrl(note.id)} className="rounded p-2 text-slate-500 hover:bg-slate-800 hover:text-white">
            <Download size={16} />
          </a>
          <button onClick={() => onDelete(note.id)} className="rounded p-2 text-slate-500 hover:bg-red-500/20 hover:text-red-400">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 bg-slate-900/50 p-4 space-y-4">
          {loadingMeta ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {summary ? (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-400">
                    <Sparkles size={14} /> AI Summary
                  </h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{summary.summary}</p>
                  {summary.key_points?.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Key points ({summary.key_points.length})</p>
                      {summary.key_points.map((p, i) => (
                        <li key={i} className="text-xs text-slate-400 flex gap-2">
                          <span className="text-indigo-500">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No summary yet. Click <strong className="text-indigo-400">Summary</strong> to generate one from this note.</p>
              )}

              {quizzes.length > 0 ? (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-400">
                    <HelpCircle size={14} /> Quizzes
                  </h3>
                  <div className="space-y-2">
                    {quizzes.map((q) => (
                      <div key={q.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                        <div>
                          <p className="text-sm text-white">{q.title}</p>
                          <p className="text-xs text-slate-500">
                            {q.question_count || q.questions?.length || '?'} questions
                            {q.best_score != null && q.total_questions ? ` · Best: ${q.best_score}/${q.total_questions}` : ''}
                          </p>
                        </div>
                        <Link to={`/quizzes/${q.id}`} className="btn-primary text-xs py-1 px-3">
                          Take Quiz
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No quizzes yet. Click <strong className="text-purple-400">Quiz</strong> to generate questions from this note.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [units, setUnits] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ unit_id: '', title: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    Promise.all([
      api.notes.list(filter || undefined),
      api.units.list(),
    ]).then(([n, u]) => { setNotes(n); setUnits(u); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !form.unit_id) return alert('Please select a unit and file');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('unit_id', form.unit_id);
      if (form.title) fd.append('title', form.title);
      await api.notes.upload(fd);
      setModal(false);
      setForm({ unit_id: '', title: '' });
      setFile(null);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this note?')) return;
    await api.notes.delete(id);
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notes</h1>
          <p className="mt-1 text-slate-500">Upload notes, create AI summaries, and generate quizzes</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary" disabled={units.length === 0}>
          <Plus size={16} /> Upload Note
        </button>
      </div>

      <div className="card border-indigo-500/20 bg-indigo-500/5 p-4">
        <p className="text-sm text-indigo-300">
          <strong>Automation flow:</strong> Upload note → Create Summary (AI) → Generate Quiz (AI + past papers) → Take Quiz → AI marks → Weak topics → Study sessions
        </p>
      </div>

      {units.length > 0 && (
        <select className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All units</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}

      {notes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No notes yet"
          description={units.length === 0 ? 'Create a unit first, then upload your notes.' : 'Upload your first note to get started.'}
          action={units.length > 0 && <button onClick={() => setModal(true)} className="btn-primary"><Plus size={16} /> Upload Note</button>}
        />
      ) : (
        <div className="grid gap-3">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onRefresh={load} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Upload Note" wide>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="label">Unit *</label>
            <select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
              <option value="">Select unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Title (optional)</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Defaults to filename" />
          </div>
          <FileUpload onChange={setFile} />
          <p className="text-xs text-slate-500">All file types accepted. PDF, DOCX, PPTX, TXT, or MD work best for AI summary and quizzes.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary">{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
