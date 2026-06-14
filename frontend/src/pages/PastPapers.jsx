import { useEffect, useState } from 'react';
import { GraduationCap, Plus, Download, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import FileUpload from '../components/FileUpload';
import { formatDateTime } from '../utils/dates';

export default function PastPapers() {
  const [papers, setPapers] = useState([]);
  const [units, setUnits] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ unit_id: '', title: '', year: '', semester: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    Promise.all([
      api.pastPapers.list(filter || undefined),
      api.units.list(),
    ]).then(([p, u]) => { setPapers(p); setUnits(u); }).catch(console.error).finally(() => setLoading(false));
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
      if (form.year) fd.append('year', form.year);
      if (form.semester) fd.append('semester', form.semester);
      await api.pastPapers.upload(fd);
      setModal(false);
      setForm({ unit_id: '', title: '', year: '', semester: '' });
      setFile(null);
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
          <p className="mt-1 text-slate-500">Store and access past exam papers by unit</p>
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
          description="Upload past exam papers to practice and review."
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
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Upload Past Paper" wide>
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary">{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
