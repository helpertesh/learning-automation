import { useEffect, useState } from 'react';
import {
  GraduationCap, Plus, Download, Trash2, BookOpen, Brain, ChevronDown, ChevronUp,
  Loader2, Sparkles, Check, AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import FileUpload from '../components/FileUpload';
import { formatDateTime } from '../utils/dates';

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

function PaperRevisionPanel({ paperId, questionCount, onQuizCreated }) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [noteExcerpt, setNoteExcerpt] = useState(null);

  const loadQuestions = () => {
    setLoading(true);
    api.pastPapers.getQuestions(paperId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const toggle = () => {
    if (!expanded && !data) loadQuestions();
    setExpanded((v) => !v);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await api.pastPapers.analyze(paperId, {});
      loadQuestions();
      setExpanded(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateQuiz = async () => {
    setCreatingQuiz(true);
    try {
      const quiz = await api.pastPapers.createQuiz(paperId);
      onQuizCreated?.(quiz);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleViewNote = async (ref) => {
    if (!ref.note_id) return;
    const pages = String(ref.pages || '1');
    const firstPage = pages.includes('-') ? pages.split('-')[0] : pages.split(',')[0];
    const lastPage = pages.includes('-') ? pages.split('-')[1] : firstPage;
    try {
      const excerpt = await api.notes.getPages(ref.note_id, firstPage, lastPage);
      setNoteExcerpt(excerpt);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {questionCount > 0
            ? `${questionCount} revision question${questionCount !== 1 ? 's' : ''} linked to notes`
            : 'Link questions to your notes'}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="btn-secondary text-xs py-1 px-2"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {questionCount > 0 ? 'Re-analyze' : 'Analyze'}
          </button>
          {questionCount > 0 && (
            <button
              type="button"
              onClick={handleCreateQuiz}
              disabled={creatingQuiz}
              className="btn-primary text-xs py-1 px-2"
            >
              {creatingQuiz ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
              Practice Quiz
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Loading questions...
            </div>
          )}
          {!loading && data?.questions?.length === 0 && (
            <p className="text-xs text-slate-500">
              Click Analyze to extract exam questions and link them to your study notes.
            </p>
          )}
          {data?.questions?.map((q, i) => (
            <div key={q.id || i} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <p className="text-sm font-medium text-white">Q{i + 1}. {q.question_text}</p>
              {q.topic && <p className="mt-1 text-xs text-slate-500">Topic: {q.topic}</p>}
              <NoteReferences refs={q.note_references} onViewNote={handleViewNote} />
              {q.solution_text && (
                <div className="mt-2 rounded bg-emerald-500/5 border border-emerald-500/10 p-2">
                  <p className="text-xs font-medium text-emerald-400 mb-1">From your notes</p>
                  <p className="text-xs text-slate-400 line-clamp-3">{q.solution_text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {noteExcerpt && (
        <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-indigo-300">
              {noteExcerpt.note_title} — pages {noteExcerpt.from}{noteExcerpt.to !== noteExcerpt.from ? `–${noteExcerpt.to}` : ''}
            </p>
            <button type="button" onClick={() => setNoteExcerpt(null)} className="text-xs text-slate-500 hover:text-white">Close</button>
          </div>
          <p className="text-xs text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">{noteExcerpt.excerpt}</p>
        </div>
      )}
    </div>
  );
}

export default function PastPapers() {
  const [papers, setPapers] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitNotes, setUnitNotes] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ unit_id: '', title: '', year: '', semester: '' });
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    Promise.all([
      api.pastPapers.list(filter || undefined),
      api.units.list(),
    ]).then(([p, u]) => { setPapers(p); setUnits(u); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  useEffect(() => {
    if (!form.unit_id) {
      setUnitNotes([]);
      setSelectedNoteIds([]);
      return;
    }
    api.notes.list(form.unit_id).then((notes) => {
      setUnitNotes(notes);
      setSelectedNoteIds(notes.map((n) => n.id));
    }).catch(console.error);
  }, [form.unit_id]);

  const toggleNote = (noteId) => {
    setSelectedNoteIds((prev) => (
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    ));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !form.unit_id) return alert('Please select a unit and file');
    if (unitNotes.length > 0 && selectedNoteIds.length === 0) {
      return alert('Select at least one note to link exam questions for revision.');
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('unit_id', form.unit_id);
      if (form.title) fd.append('title', form.title);
      if (form.year) fd.append('year', form.year);
      if (form.semester) fd.append('semester', form.semester);
      if (selectedNoteIds.length > 0) {
        fd.append('note_ids', JSON.stringify(selectedNoteIds));
      }
      const result = await api.pastPapers.upload(fd);
      setModal(false);
      setForm({ unit_id: '', title: '', year: '', semester: '' });
      setFile(null);
      setSelectedNoteIds([]);
      if (result.revision?.error) {
        alert(`Paper uploaded, but revision linking failed: ${result.revision.error}`);
      }
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this past paper?')) return;
    await api.pastPapers.delete(id);
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Past Papers</h1>
          <p className="mt-1 text-slate-500">
            Upload exams and revision questions — questions are linked to your notes for study
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary" disabled={units.length === 0}>
          <Plus size={16} /> Upload Paper
        </button>
      </div>

      {units.length > 0 && (
        <select className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All units</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}

      {papers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No past papers yet"
          description="Upload past exam papers — we'll extract questions and link them to your study notes."
          action={units.length > 0 && <button onClick={() => setModal(true)} className="btn-primary"><Plus size={16} /> Upload Paper</button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {papers.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <GraduationCap size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.unit_name}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <a href={api.pastPapers.downloadUrl(p.id)} className="rounded p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><Download size={16} /></a>
                  <button onClick={() => handleDelete(p.id)} className="rounded p-2 text-slate-500 hover:bg-red-500/20 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-slate-500">
                {p.year && <span>Year: {p.year}</span>}
                {p.semester && <span>Sem: {p.semester}</span>}
                <span>{formatDateTime(p.created_at)}</span>
              </div>
              <PaperRevisionPanel
                paperId={p.id}
                questionCount={p.question_count || 0}
                onQuizCreated={(quiz) => { window.location.href = `/quizzes/${quiz.id}`; }}
              />
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Upload Past Paper / Revision Questions" wide>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="label">Unit *</label>
            <select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
              <option value="">Select unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Title (optional)</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Final Exam" />
            </div>
            <div>
              <label className="label">Year</label>
              <input className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2024" />
            </div>
          </div>
          <div>
            <label className="label">Semester</label>
            <input className="input" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="e.g. Sem 1" />
          </div>
          <FileUpload onChange={setFile} />

          {form.unit_id && (
            <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-white">Study Notes for Revision</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select notes to reference when extracting questions — solutions will come from these notes
                </p>
              </div>
              {unitNotes.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-amber-300">
                  <AlertCircle size={14} />
                  No notes for this unit. Upload notes first for note-linked revision.
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {unitNotes.map((note) => {
                    const selected = selectedNoteIds.includes(note.id);
                    return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => toggleNote(note.id)}
                        className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm transition ${
                          selected ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded border ${
                          selected ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400' : 'border-slate-600'
                        }`}>
                          {selected && <Check size={12} />}
                        </span>
                        {note.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? 'Uploading & linking to notes...' : 'Upload & Link to Notes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
