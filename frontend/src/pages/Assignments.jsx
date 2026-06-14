import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Check, Trash2, Pencil } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { formatDateTime, relativeDeadline, deadlineColor } from '../utils/dates';

const emptyForm = {
  unit_id: '', title: '', description: '', deadline: '', priority: 'medium', reminder_days: 3,
};

const priorityColors = { high: 'bg-red-500/20 text-red-400', medium: 'bg-amber-500/20 text-amber-400', low: 'bg-slate-500/20 text-slate-400' };

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [units, setUnits] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const listPromise = filter === 'pending'
      ? api.assignments.list().then((all) => all.filter((a) => a.status !== 'completed'))
      : filter === 'all'
        ? api.assignments.list()
        : api.assignments.list({ status: filter });

    Promise.all([listPromise, api.units.list()])
      .then(([a, u]) => { setAssignments(a); setUnits(u); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({
      unit_id: String(a.unit_id),
      title: a.title,
      description: a.description || '',
      deadline: a.deadline.slice(0, 16),
      priority: a.priority,
      reminder_days: a.reminder_days,
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, unit_id: Number(form.unit_id), reminder_days: Number(form.reminder_days) };
      if (editing) await api.assignments.update(editing.id, body);
      else await api.assignments.create(body);
      setModal(false);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (id) => {
    await api.assignments.update(id, { status: 'completed' });
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this assignment?')) return;
    await api.assignments.delete(id);
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Assignments</h1>
          <p className="mt-1 text-slate-500">Track deadlines and get notified before they're due</p>
        </div>
        <button onClick={openCreate} className="btn-primary" disabled={units.length === 0}>
          <Plus size={16} /> Add Assignment
        </button>
      </div>

      <div className="flex gap-2">
        {['pending', 'completed', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments"
          description="Add assignments with deadlines to receive reminders."
          action={units.length > 0 && <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Assignment</button>}
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="card flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                {a.status !== 'completed' && (
                  <button onClick={() => markComplete(a.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-500 hover:border-emerald-500 hover:text-emerald-400" title="Mark complete">
                    <Check size={16} />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${a.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{a.title}</p>
                    <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${priorityColors[a.priority]}`}>{a.priority}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: a.unit_color }} />
                    {a.unit_name} &middot; {formatDateTime(a.deadline)}
                  </p>
                  {a.description && <p className="mt-1 text-sm text-slate-400">{a.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.status !== 'completed' && (
                  <span className={`text-xs font-medium ${deadlineColor(a.deadline)}`}>{relativeDeadline(a.deadline)}</span>
                )}
                <button onClick={() => openEdit(a)} className="rounded p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(a.id)} className="rounded p-2 text-slate-500 hover:bg-red-500/20 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Assignment' : 'Add Assignment'} wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Unit *</label>
            <select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
              <option value="">Select unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Lab Report 3" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Deadline *</label>
              <input type="datetime-local" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required />
            </div>
            <div>
              <label className="label">Remind me (days before)</label>
              <input type="number" min="1" max="30" className="input" value={form.reminder_days} onChange={(e) => setForm({ ...form, reminder_days: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
