import { useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

const emptyForm = { name: '', code: '', description: '', color: '#6366f1' };

export default function Units() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.units.list().then(setUnits).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (unit) => {
    setEditing(unit);
    setForm({ name: unit.name, code: unit.code || '', description: unit.description || '', color: unit.color });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.units.update(editing.id, form);
      else await api.units.create(form);
      setModal(false);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this unit and all its notes, papers, and assignments?')) return;
    await api.units.delete(id);
    load();
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Units</h1>
          <p className="mt-1 text-slate-500">Manage your courses and subjects</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Unit</button>
      </div>

      {units.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No units yet"
          description="Add your first unit to start organizing notes, papers, and assignments."
          action={<button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Unit</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <div key={u.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: u.color }}>
                    {(u.code || u.name).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{u.name}</h3>
                    {u.code && <p className="text-xs text-slate-500">{u.code}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(u)} className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(u.id)} className="rounded p-1.5 text-slate-500 hover:bg-red-500/20 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              {u.description && <p className="mb-3 text-sm text-slate-400 line-clamp-2">{u.description}</p>}
              <div className="flex gap-4 text-xs text-slate-500">
                <span>{u.notes_count} notes</span>
                <span>{u.papers_count} papers</span>
                <span>{u.assignments_count} tasks</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Unit' : 'Add Unit'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Unit Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Data Structures" />
          </div>
          <div>
            <label className="label">Unit Code</label>
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. CS201" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
          </div>
          <div>
            <label className="label">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`h-7 w-7 rounded-full transition ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
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
