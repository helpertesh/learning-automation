import { useEffect, useState } from 'react';
import { Timer, Plus, Trash2, Flame } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { formatDateTime, formatMinutes } from '../utils/dates';

export default function Study() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ unit_id: '', duration_minutes: 30, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      api.studySessions.list(30),
      api.studySessions.stats(),
      api.units.list(),
    ]).then(([s, st, u]) => { setSessions(s); setStats(st); setUnits(u); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.studySessions.create({
        unit_id: form.unit_id ? Number(form.unit_id) : null,
        duration_minutes: Number(form.duration_minutes),
        notes: form.notes,
      });
      setModal(false);
      setForm({ unit_id: '', duration_minutes: 30, notes: '' });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this session?')) return;
    await api.studySessions.delete(id);
    load();
  };

  const quickLog = async (mins) => {
    await api.studySessions.create({ duration_minutes: mins });
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  const maxBar = Math.max(...(stats.daily_chart.map((d) => d.minutes) || [1]), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Study Log</h1>
          <p className="mt-1 text-slate-500">Track your daily study sessions and build a streak</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary"><Plus size={16} /> Log Session</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 text-center">
          <p className="text-sm text-slate-500">Today</p>
          <p className="mt-1 text-3xl font-bold text-white">{formatMinutes(stats.today_minutes)}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-sm text-slate-500">This Week</p>
          <p className="mt-1 text-3xl font-bold text-white">{formatMinutes(stats.week_minutes)}</p>
        </div>
        <div className="card p-5 text-center">
          <div className="flex items-center justify-center gap-1 text-sm text-slate-500">
            <Flame size={14} className="text-orange-400" /> Streak
          </div>
          <p className="mt-1 text-3xl font-bold text-white">{stats.streak_days} <span className="text-base font-normal text-slate-500">days</span></p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-400">Last 7 days</h2>
        <div className="flex items-end gap-2 h-32">
          {stats.daily_chart.length === 0 ? (
            <p className="text-sm text-slate-600">No study data yet</p>
          ) : (
            stats.daily_chart.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-indigo-600 transition-all" style={{ height: `${(d.minutes / maxBar) * 100}%`, minHeight: d.minutes ? '4px' : '0' }} />
                <span className="text-[10px] text-slate-600">{d.day.slice(5)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-slate-500 self-center">Quick log:</span>
        {[15, 30, 45, 60, 90].map((m) => (
          <button key={m} onClick={() => quickLog(m)} className="btn-secondary text-xs">+{m}m</button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <EmptyState icon={Timer} title="No study sessions" description="Start logging your study time to track progress." />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-white">{formatMinutes(s.duration_minutes)}</p>
                <p className="text-xs text-slate-500">
                  {s.unit_name ? (
                    <><span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: s.unit_color }} />{s.unit_name} &middot; </>
                  ) : null}
                  {formatDateTime(s.studied_at)}
                </p>
                {s.notes && <p className="mt-1 text-sm text-slate-400">{s.notes}</p>}
                {s.session_type === 'weak_topic_review' && (
                  <span className="mt-1 inline-block rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                    Auto-scheduled · {s.topic_name}
                  </span>
                )}
              </div>
              <button onClick={() => handleDelete(s.id)} className="rounded p-2 text-slate-500 hover:bg-red-500/20 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Log Study Session">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Unit (optional)</label>
            <select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
              <option value="">General study</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Duration (minutes) *</label>
            <input type="number" min="1" className="input" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} required />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What did you study?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Log Session'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
