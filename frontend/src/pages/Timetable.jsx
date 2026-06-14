import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Pencil } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const emptyForm = {
  day_of_week: 1, start_time: '08:00', end_time: '09:00', unit_id: '', label: '', location: '',
};

export default function Timetable() {
  const [slots, setSlots] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([api.timetable.list(), api.units.list()])
      .then(([s, u]) => { setSlots(s); setUnits(u); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = (day) => {
    setEditing(null);
    setForm({ ...emptyForm, day_of_week: day ?? 1 });
    setModal(true);
  };

  const openEdit = (slot) => {
    setEditing(slot);
    setForm({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      unit_id: slot.unit_id ? String(slot.unit_id) : '',
      label: slot.label || '',
      location: slot.location || '',
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        day_of_week: Number(form.day_of_week),
        unit_id: form.unit_id ? Number(form.unit_id) : null,
      };
      if (editing) await api.timetable.update(editing.id, body);
      else await api.timetable.create(body);
      setModal(false);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this timetable slot?')) return;
    await api.timetable.delete(id);
    load();
  };

  const slotsByDay = DAYS.map((_, day) =>
    slots.filter((s) => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time))
  );

  const today = new Date().getDay();
  const todaySlots = slotsByDay[today];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Study Timetable</h1>
          <p className="mt-1 text-slate-500">Plan your weekly classes and study sessions</p>
        </div>
        <button onClick={() => openCreate()} className="btn-primary"><Plus size={16} /> Add Slot</button>
      </div>

      {todaySlots.length > 0 && (
        <div className="card border-indigo-500/20 bg-indigo-500/5 p-4">
          <p className="text-sm font-medium text-indigo-300">Today — {DAYS[today]}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {todaySlots.map((s) => (
              <span key={s.id} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white">
                {s.start_time}–{s.end_time} {s.unit_name || s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {slots.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No timetable yet"
          description="Add your class schedule and dedicated study blocks for each unit."
          action={<button onClick={() => openCreate()} className="btn-primary"><Plus size={16} /> Add First Slot</button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((dayName, dayIndex) => (
            <div key={dayName} className={`card p-4 ${dayIndex === today ? 'border-indigo-500/30' : ''}`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className={`font-semibold ${dayIndex === today ? 'text-indigo-400' : 'text-white'}`}>
                  {dayName}
                </h3>
                <button onClick={() => openCreate(dayIndex)} className="text-xs text-indigo-400 hover:underline">+ Add</button>
              </div>
              {slotsByDay[dayIndex].length === 0 ? (
                <p className="text-xs text-slate-600">No slots</p>
              ) : (
                <div className="space-y-2">
                  {slotsByDay[dayIndex].map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{s.start_time} – {s.end_time}</p>
                        <p className="truncate text-sm font-medium text-white">
                          {s.unit_name || s.label || 'Study block'}
                        </p>
                        {s.location && <p className="text-xs text-slate-500">{s.location}</p>}
                      </div>
                      <div className="flex gap-1 ml-2">
                        {s.unit_color && <span className="h-2 w-2 rounded-full mt-1" style={{ backgroundColor: s.unit_color }} />}
                        <button onClick={() => openEdit(s)} className="rounded p-1 text-slate-500 hover:text-white"><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Slot' : 'Add Timetable Slot'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Day</label>
            <select className="input" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Start time</label>
              <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div>
              <label className="label">End time</label>
              <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">Unit (optional)</label>
            <select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
              <option value="">No specific unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Label</label>
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Revision, Lab, Lecture" />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Room 204, Library" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
