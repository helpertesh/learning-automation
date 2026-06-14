import { useEffect, useState } from 'react';
import {
  Brain, Plus, Check, Trash2, Sparkles, AlertCircle, BookOpen, Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
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
  const [topics, setTopics] = useState([]);
  const [topicStats, setTopicStats] = useState({ total: 0, covered: 0 });
  const [prepData, setPrepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [topicModal, setTopicModal] = useState(false);
  const [bulkTopics, setBulkTopics] = useState('');
  const [newTopic, setNewTopic] = useState('');

  const loadUnits = () => api.units.list().then(setUnits);

  const loadTopics = (unitId) => {
    if (!unitId) return;
    api.topics.list(unitId).then(({ topics: t, stats }) => {
      setTopics(t);
      setTopicStats(stats);
    });
  };

  const loadPrep = (unitId) => {
    if (!unitId) return;
    api.examPrep.get(unitId).then(setPrepData).catch(console.error);
  };

  useEffect(() => {
    loadUnits().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedUnit) {
      loadTopics(selectedUnit);
      loadPrep(selectedUnit);
    }
  }, [selectedUnit]);

  const toggleCover = async (topic) => {
    await api.topics.toggleCover(topic.id, !topic.is_covered);
    loadTopics(selectedUnit);
    loadPrep(selectedUnit);
  };

  const addTopic = async (e) => {
    e.preventDefault();
    if (!newTopic.trim()) return;
    await api.topics.create({ unit_id: Number(selectedUnit), name: newTopic.trim() });
    setNewTopic('');
    loadTopics(selectedUnit);
  };

  const addBulkTopics = async (e) => {
    e.preventDefault();
    const names = bulkTopics.split('\n').map((l) => l.trim()).filter(Boolean);
    if (names.length === 0) return;
    await api.topics.bulk({ unit_id: Number(selectedUnit), topics: names });
    setBulkTopics('');
    setTopicModal(false);
    loadTopics(selectedUnit);
  };

  const deleteTopic = async (id) => {
    await api.topics.delete(id);
    loadTopics(selectedUnit);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await api.examPrep.analyze({ unit_id: Number(selectedUnit) });
      setPrepData((prev) => ({
        ...prev,
        latest_analysis: result,
        latest_analysis_at: new Date().toISOString(),
        coverage_percentage: result.coverage?.percentage ?? prev?.coverage_percentage,
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
  const coveragePct = prepData?.coverage_percentage ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Exam Prep</h1>
        <p className="mt-1 text-slate-500">
          Track syllabus coverage, analyze past papers, and get predicted questions with solutions from your notes
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
          description="Choose a unit, add syllabus topics, mark what you've covered, then analyze past papers against your notes."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Syllabus Coverage</p>
              <p className="mt-1 text-2xl font-bold text-white">{coveragePct}%</p>
              <p className="text-xs text-slate-600">{topicStats.covered}/{topicStats.total} topics</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Notes</p>
              <p className="mt-1 text-2xl font-bold text-white">{prepData?.unit?.notes_count ?? 0}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Past Papers</p>
              <p className="mt-1 text-2xl font-bold text-white">{prepData?.unit?.papers_count ?? 0}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-500">Predicted Questions</p>
              <p className="mt-1 text-2xl font-bold text-white">{analysis?.likely_questions?.length ?? 0}</p>
            </div>
          </div>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-white">Syllabus Topics</h2>
              <button onClick={() => setTopicModal(true)} className="btn-secondary text-xs"><Plus size={14} /> Bulk Add</button>
            </div>

            <form onSubmit={addTopic} className="mb-4 flex gap-2">
              <input className="input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Add topic e.g. Binary Search Trees" />
              <button type="submit" className="btn-primary shrink-0"><Plus size={16} /></button>
            </form>

            {topics.length === 0 ? (
              <p className="text-sm text-slate-500">Add topics from your syllabus, then check off topics you've covered in class.</p>
            ) : (
              <div className="space-y-2">
                {topics.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                    <button
                      onClick={() => toggleCover(t)}
                      className={`flex h-6 w-6 items-center justify-center rounded border transition ${
                        t.is_covered ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-slate-600 text-transparent hover:border-emerald-500'
                      }`}
                    >
                      <Check size={14} />
                    </button>
                    <span className={`flex-1 mx-3 text-sm ${t.is_covered ? 'text-white' : 'text-slate-400'}`}>{t.name}</span>
                    {t.is_covered && t.covered_at && (
                      <span className="text-xs text-slate-600 mr-2">covered {t.covered_at.slice(0, 10)}</span>
                    )}
                    <button onClick={() => deleteTopic(t.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Analyze Past Papers</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Reviews papers against covered topics only — solutions pulled from your uploaded notes
                </p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={analyzing || topicStats.covered === 0}
                className="btn-primary"
              >
                {analyzing ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : <><Sparkles size={16} /> Run Analysis</>}
              </button>
            </div>

            {topicStats.covered === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-300">
                <AlertCircle size={16} /> Mark at least one topic as covered before analyzing.
              </div>
            )}

            {(prepData?.unit?.notes_count ?? 0) === 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-300">
                <AlertCircle size={16} /> Upload notes for this unit — solutions are generated from your notes.
              </div>
            )}

            {analysis && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/20 p-4">
                  <p className="text-sm text-indigo-200">{analysis.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Mode: {analysis.mode === 'ai' ? 'AI-enhanced' : 'Smart matching'}
                    {analysis.latest_analysis_at || prepData?.latest_analysis_at
                      ? ` · ${formatDateTime(prepData?.latest_analysis_at || analysis.meta?.analyzed_at)}`
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
                    <h3 className="mb-3 text-sm font-medium text-slate-400">Likely Exam Questions & Solutions</h3>
                    <div className="space-y-3">
                      {analysis.likely_questions.map((q, i) => (
                        <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded border px-2 py-0.5 text-xs capitalize ${priorityStyle[q.priority] || priorityStyle.medium}`}>
                              {q.priority || 'medium'}
                            </span>
                            <span className="text-xs text-indigo-400">{q.topic}</span>
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

      <Modal open={topicModal} onClose={() => setTopicModal(false)} title="Bulk Add Topics">
        <form onSubmit={addBulkTopics} className="space-y-4">
          <p className="text-sm text-slate-400">Paste one topic per line from your syllabus or course outline.</p>
          <textarea
            className="input"
            rows={8}
            value={bulkTopics}
            onChange={(e) => setBulkTopics(e.target.value)}
            placeholder={"Introduction to Algorithms\nArrays and Linked Lists\nStacks and Queues\nTrees and Graphs"}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTopicModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Topics</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
