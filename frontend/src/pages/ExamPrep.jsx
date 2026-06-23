import { useEffect, useState } from 'react';
import {
  Brain, Check, Sparkles, AlertCircle, BookOpen, Loader2, FileText,
} from 'lucide-react';
import { api } from '../api/client';
import EmptyState from '../components/EmptyState';
import { formatDateTime } from '../utils/dates';

const priorityStyle = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export default function ExamPrep() {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [notes, setNotes] = useState([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [prepData, setPrepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const loadUnits = () => api.units.list().then(setUnits);

  const loadNotes = (unitId) => {
    if (!unitId) return Promise.resolve();
    return api.notes.list(unitId).then((unitNotes) => {
      setNotes(unitNotes);
      setSelectedNoteIds((prev) => {
        if (prev.length > 0) {
          const valid = prev.filter((id) => unitNotes.some((n) => n.id === id));
          if (valid.length > 0) return valid;
        }
        return unitNotes.map((n) => n.id);
      });
    });
  };

  const loadPrep = (unitId) => {
    if (!unitId) return;
    api.examPrep.get(unitId).then((data) => {
      setPrepData(data);
      if (data.selected_note_ids?.length) {
        setSelectedNoteIds(data.selected_note_ids);
      }
    }).catch(console.error);
  };

  useEffect(() => {
    loadUnits().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedUnit) {
      loadNotes(selectedUnit);
      loadPrep(selectedUnit);
    } else {
      setNotes([]);
      setSelectedNoteIds([]);
      setPrepData(null);
    }
  }, [selectedUnit]);

  const toggleNote = (noteId) => {
    setSelectedNoteIds((prev) => (
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId]
    ));
  };

  const selectAllNotes = () => setSelectedNoteIds(notes.map((n) => n.id));
  const clearNotes = () => setSelectedNoteIds([]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await api.examPrep.analyze({
        unit_id: Number(selectedUnit),
        note_ids: selectedNoteIds,
      });
      setPrepData((prev) => ({
        ...prev,
        latest_analysis: result,
        latest_analysis_at: new Date().toISOString(),
        selected_note_ids: selectedNoteIds,
      }));
    } catch (err) {
      alert(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  const analysis = prepData?.latest_analysis;
  const papersCount = prepData?.unit?.papers_count ?? 0;
  const canAnalyze = selectedNoteIds.length > 0 && papersCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Exam Prep</h1>
        <p className="mt-1 text-slate-500">
          Select your study notes, then analyze past papers — questions from papers, solutions from your notes
        </p>
      </div>

      <select className="input max-w-md" value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
        <option value="">Select a unit</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      {!selectedUnit ? (
        <EmptyState
          icon={Brain}
          title="Select a unit to begin"
          description="Choose a unit, pick the notes you've studied, then run analysis on past papers."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Notes Selected</p>
              <p className="mt-1 text-2xl font-bold text-white">{selectedNoteIds.length}</p>
              <p className="text-xs text-slate-600">of {notes.length} available</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Past Papers</p>
              <p className="mt-1 text-2xl font-bold text-white">{papersCount}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Predicted Questions</p>
              <p className="mt-1 text-2xl font-bold text-white">{analysis?.likely_questions?.length ?? 0}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Analysis Mode</p>
              <p className="mt-1 text-lg font-bold text-white capitalize">{analysis?.mode === 'ai' ? 'AI' : analysis ? 'Smart' : '—'}</p>
            </div>
          </div>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Study Notes</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Select the notes you have covered — AI will use these for solutions
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={selectAllNotes} className="btn-secondary text-xs">Select All</button>
                <button type="button" onClick={clearNotes} className="btn-secondary text-xs">Clear</button>
              </div>
            </div>

            {notes.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-300">
                <AlertCircle size={16} />
                No notes for this unit yet. Upload notes on the Notes page first.
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => {
                  const selected = selectedNoteIds.includes(note.id);
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => toggleNote(note.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border transition ${
                        selected ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400' : 'border-slate-600 text-transparent'
                      }`}>
                        <Check size={14} />
                      </span>
                      <FileText size={16} className="shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${selected ? 'text-white' : 'text-slate-400'}`}>
                          {note.title}
                        </p>
                        <p className="truncate text-xs text-slate-600">{note.original_name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Analyze Past Papers</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Extracts exam questions from past papers and writes solutions from your selected notes
                </p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={analyzing || !canAnalyze}
                className="btn-primary"
              >
                {analyzing ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : <><Sparkles size={16} /> Run Analysis</>}
              </button>
            </div>

            {selectedNoteIds.length === 0 && notes.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-300">
                <AlertCircle size={16} /> Select at least one note to use for solutions.
              </div>
            )}

            {papersCount === 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-300">
                <AlertCircle size={16} /> Upload past papers for this unit — questions are pulled from them.
              </div>
            )}

            {analysis && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/20 p-4">
                  <p className="text-sm text-indigo-200">{analysis.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Mode: {analysis.mode === 'ai' ? 'AI-enhanced' : 'Smart matching'}
                    {analysis.meta?.notes_used?.length
                      ? ` · ${analysis.meta.notes_used.length} note(s) used`
                      : ''}
                    {prepData?.latest_analysis_at
                      ? ` · ${formatDateTime(prepData.latest_analysis_at)}`
                      : ''}
                  </p>
                </div>

                {analysis.study_tips?.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-400">Study Tips</h3>
                    <ul className="space-y-1">
                      {analysis.study_tips.map((tip, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-2">
                          <BookOpen size={14} className="text-indigo-400 mt-0.5 shrink-0" /> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.gaps?.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-amber-400">Gaps to Fix</h3>
                    <ul className="space-y-1">
                      {analysis.gaps.map((gap, i) => (
                        <li key={i} className="text-sm text-slate-400">• {gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.likely_questions?.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium text-slate-400">Exam Questions & Solutions</h3>
                    <div className="space-y-3">
                      {analysis.likely_questions.map((q, i) => (
                        <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded border px-2 py-0.5 text-xs capitalize ${priorityStyle[q.priority] || priorityStyle.medium}`}>
                              {q.priority || 'medium'}
                            </span>
                            {q.topic && <span className="text-xs text-indigo-400">{q.topic}</span>}
                            {q.from_paper && <span className="text-xs text-slate-600">from {q.from_paper}</span>}
                          </div>
                          <p className="text-sm font-medium text-white">{q.question}</p>
                          <div className="mt-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
                            <p className="text-xs font-medium text-emerald-400 mb-1">
                              Solution {q.note_source ? `· from "${q.note_source}"` : ''}
                            </p>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{q.solution}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
