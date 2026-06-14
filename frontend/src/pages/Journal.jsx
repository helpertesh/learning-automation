import { useEffect, useState } from 'react';
import { BookMarked, Plus, Trash2, Pencil, Flame, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { formatDateTime } from '../utils/dates';

const emptyForm = {
  unit_id: '', topic: '', learned: '', goals: '', cursor_notes: '', rating: 3,
};

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function Journal() {
  const [logs, setLogs] = useState([]);
  const [units, setUnits] = useState([]);
  const [streak, setStreak] = useState({ streak_days: 0, total_logs: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      api.trainingLogs.list(60),
      api.trainingLogs.streak(),
      api.units.list(),
    ]).then(([l, s, u]) => {
      setLogs(l);
      setStreak(s);
      setUnits(u);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (log) => {
    setEditing(log);
    setForm({
      unit_id: log.unit_id ? String(log.unit_id) : '',
      topic: log.topic,
      learned: log.learned || '',
      goals: log.goals || '',
      cursor_notes: log.cursor_notes || '',
      rating: log.rating,
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        unit_id: form.unit_id ? Number(form.unit_id) : null,
        rating: Number(form.rating),
      };
      if (editing) await api.trainingLogs.update(editing.id, body);
      else await api.trainingLogs.create(body);
      setModal(false);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this journal entry?')) return;
    await api.trainingLogs.delete(id);
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Training Journal</h1>
          <p className="mt-1 text-slate-500">Log what you learn each day — train StudyFlow with Cursor step by step</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Today's Entry</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 text-center">
          <div className="flex items-center justify-center gap-1 text-sm text-slate-500">
            <Flame size={14} className="text-orange-400" /> Training Streak
          </div>
          <p className="mt-1 text-3xl font-bold text-white">{streak.streak_days} <span className="text-base font-normal text-slate-500">days</span></p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-sm text-slate-500">Total Entries</p>
          <p className="mt-1 text-3xl font-bold text-white">{streak.total_logs}</p>
        </div>
        <div className="card border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex items-center gap-2 text-sm text-indigo-400">
            <Sparkles size={14} /> Cursor Tip
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Use the "Cursor Notes" field to record prompts, features, or workflows you discovered. This builds your personal study playbook over time.
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="Start your training journal"
          description="Record what you studied today. Over time, this becomes your personalized learning history."
          action={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> Write First Entry</button>}
        />
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{log.topic}</h3>
                    <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-400">
                      {RATING_LABELS[log.rating]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {log.unit_name && (
                      <><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: log.unit_color }} />{log.unit_name} &middot; </>
                    )}
                    {log.log_date} &middot; {formatDateTime(log.created_at)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(log)} className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(log.id)} className="rounded p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              {log.learned && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-slate-500">What I learned</p>
                  <p className="text-sm text-slate-300">{log.learned}</p>
                </div>
              )}
              {log.goals && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-slate-500">Tomorrow's goals</p>
                  <p className="text-sm text-slate-300">{log.goals}</p>
                </div>
              )}
              {log.cursor_notes && (
                <div className="mt-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 p-3">
                  <p className="text-xs font-medium text-indigo-400">Cursor Notes</p>
                  <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{log.cursor_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Entry' : "Today's Training Entry"} wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Topic *</label>
            <input className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required placeholder="e.g. Linked Lists — insertion & deletion" />
          </div>
          <div>
            <label className="label">Unit (optional)</label>
            <select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
              <option value="">General</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">What did you learn today?</label>
            <textarea className="input" rows={3} value={form.learned} onChange={(e) => setForm({ ...form, learned: e.target.value })} placeholder="Summarize key concepts, formulas, or insights..." />
          </div>
          <div>
            <label className="label">Goals for tomorrow</label>
            <textarea className="input" rows={2} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} placeholder="What will you focus on next?" />
          </div>
          <div>
            <label className="label">Cursor Notes</label>
            <textarea className="input" rows={3} value={form.cursor_notes} onChange={(e) => setForm({ ...form, cursor_notes: e.target.value })} placeholder="Prompts used, features learned, workflows to remember..." />
          </div>
          <div>
            <label className="label">How productive was today? ({RATING_LABELS[form.rating]})</label>
            <input type="range" min="1" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="w-full accent-indigo-500" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Save Entry'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
