import { useEffect, useState } from 'react';
import {
  Sparkles, RefreshCw, CheckCircle2, Lightbulb, Wrench,
  ExternalLink, Flame, Target, Plus, Trash2, Pencil, Rocket,
} from 'lucide-react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

function categoryLabel(categories, id) {
  const cat = categories.find((c) => c.id === id);
  return cat ? `${cat.emoji} ${cat.label}` : id;
}

export default function DailySkills() {
  const [lesson, setLesson] = useState(null);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [skills, setSkills] = useState([]);
  const [streak, setStreak] = useState({ streak_days: 0, total_completed: 0, categories_explored: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [skillsModal, setSkillsModal] = useState(false);
  const [completeModal, setCompleteModal] = useState(false);
  const [skillForm, setSkillForm] = useState([]);
  const [reflection, setReflection] = useState('');
  const [duration, setDuration] = useState(20);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);

  const load = () => {
    Promise.all([
      api.skillLearning.today(),
      api.skillLearning.history(20),
      api.skillLearning.categories(),
      api.skillLearning.skills(),
      api.skillLearning.streak(),
      api.ai.status().catch(() => ({ configured: false })),
    ]).then(([today, hist, cats, sk, st, ai]) => {
      setLesson(today);
      setHistory(hist.filter((l) => l.id !== today?.id));
      setCategories(cats);
      setSkills(sk);
      setSkillForm(sk.length ? sk : [{ skill_name: 'Website Design', level: 'intermediate' }]);
      setStreak(st);
      setAiEnabled(ai?.configured);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleGenerate = async (regenerate = false) => {
    setGenerating(true);
    try {
      const { lesson: newLesson, ai_enabled } = await api.skillLearning.generate({
        category: selectedCategory || undefined,
        regenerate,
      });
      setLesson(newLesson);
      setAiEnabled(ai_enabled);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!lesson) return;
    setCompleting(true);
    try {
      const updated = await api.skillLearning.complete(lesson.id, {
        reflection,
        duration_minutes: duration,
      });
      setLesson(updated);
      setCompleteModal(false);
      setReflection('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCompleting(false);
    }
  };

  const saveSkills = async (e) => {
    e.preventDefault();
    try {
      const saved = await api.skillLearning.saveSkills(skillForm.filter((s) => s.skill_name.trim()));
      setSkills(saved);
      setSkillsModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const addSkillRow = () => setSkillForm([...skillForm, { skill_name: '', level: 'beginner' }]);
  const removeSkillRow = (i) => setSkillForm(skillForm.filter((_, idx) => idx !== i));
  const updateSkillRow = (i, field, value) => {
    const next = [...skillForm];
    next[i] = { ...next[i], [field]: value };
    setSkillForm(next);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Daily IT Skills</h1>
          <p className="mt-1 text-slate-500">
            Learn something new in IT every day — cybersecurity, coding, video editing, and more
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSkillsModal(true)} className="btn-secondary">
            <Pencil size={16} /> My Skills
          </button>
          {!lesson && (
            <button onClick={() => handleGenerate(false)} disabled={generating} className="btn-primary">
              <Sparkles size={16} /> {generating ? 'Generating...' : "Get Today's Lesson"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 text-center">
          <div className="flex items-center justify-center gap-1 text-sm text-slate-500">
            <Flame size={14} className="text-orange-400" /> Learning Streak
          </div>
          <p className="mt-1 text-3xl font-bold text-white">
            {streak.streak_days} <span className="text-base font-normal text-slate-500">days</span>
          </p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-sm text-slate-500">Lessons Completed</p>
          <p className="mt-1 text-3xl font-bold text-white">{streak.total_completed}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-sm text-slate-500">Skill Areas Explored</p>
          <p className="mt-1 text-3xl font-bold text-white">{streak.categories_explored}</p>
        </div>
      </div>

      <div className="card border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Target size={16} /> Your skills: {skills.map((s) => s.skill_name).join(', ') || 'None set'}
          </div>
          <p className="text-xs text-slate-500">
            Lessons skip basics in skills you already know and focus on in-demand areas
          </p>
        </div>
      </div>

      {!lesson ? (
        <EmptyState
          icon={Rocket}
          title="Ready to learn something new?"
          description={
            aiEnabled
              ? 'Generate your personalized daily IT lesson. AI picks topics based on your skills and what you have not learned yet.'
              : 'Generate a daily lesson from our curated library. Add OPENAI_API_KEY for AI-personalized lessons.'
          }
          action={
            <div className="flex flex-col items-center gap-3">
              <select
                className="input max-w-xs"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Surprise me (auto-pick)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <button onClick={() => handleGenerate(false)} disabled={generating} className="btn-primary">
                <Sparkles size={16} /> {generating ? 'Generating...' : "Get Today's Lesson"}
              </button>
            </div>
          }
        />
      ) : (
        <div className={`card p-6 ${lesson.completed ? 'border-emerald-500/30' : 'border-indigo-500/30'}`}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-400">
                {categoryLabel(categories, lesson.skill_category)}
              </span>
              <h2 className="mt-2 text-xl font-bold text-white">{lesson.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{lesson.lesson_date}</p>
            </div>
            <div className="flex gap-2">
              {!lesson.completed && (
                <>
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                    className="btn-secondary text-xs"
                    title="Get a different lesson for today"
                  >
                    <RefreshCw size={14} className={generating ? 'animate-spin' : ''} /> New topic
                  </button>
                  <button onClick={() => setCompleteModal(true)} className="btn-primary text-xs">
                    <CheckCircle2 size={14} /> Mark complete
                  </button>
                </>
              )}
              {lesson.completed && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 size={14} /> Completed
                </span>
              )}
            </div>
          </div>

          {lesson.overview && (
            <p className="text-sm leading-relaxed text-slate-300">{lesson.overview}</p>
          )}

          {lesson.key_concepts?.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-400">
                <Lightbulb size={16} /> Key concepts
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {lesson.key_concepts.map((concept, i) => (
                  <li key={i} className="rounded-lg bg-slate-800/50 px-3 py-2 text-sm text-slate-300">
                    {concept}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lesson.practical_task && (
            <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-400">
                <Wrench size={16} /> Today's task (15–30 min)
              </div>
              <p className="text-sm text-slate-300">{lesson.practical_task}</p>
            </div>
          )}

          {lesson.resources?.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-400">Free resources</p>
              <div className="flex flex-wrap gap-2">
                {lesson.resources.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-indigo-400 hover:border-indigo-500/50"
                  >
                    {r.name} <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {lesson.reflection && (
            <div className="mt-5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-4">
              <p className="text-xs font-medium text-emerald-400">Your reflection</p>
              <p className="mt-1 text-sm text-slate-300">{lesson.reflection}</p>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-white">Past lessons</h3>
          <div className="space-y-2">
            {history.map((l) => (
              <div key={l.id} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-white">{l.title}</p>
                  <p className="text-xs text-slate-500">
                    {categoryLabel(categories, l.skill_category)} &middot; {l.lesson_date}
                  </p>
                </div>
                {l.completed ? (
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <span className="text-xs text-slate-500">Skipped</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={skillsModal} onClose={() => setSkillsModal(false)} title="My IT Skills" wide>
        <p className="mb-4 text-sm text-slate-400">
          List skills you already have. Lessons will avoid teaching you basics in these areas and focus on new in-demand skills.
        </p>
        <form onSubmit={saveSkills} className="space-y-3">
          {skillForm.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                value={s.skill_name}
                onChange={(e) => updateSkillRow(i, 'skill_name', e.target.value)}
                placeholder="e.g. Website Design, Python, Photoshop"
              />
              <select
                className="input w-36"
                value={s.level}
                onChange={(e) => updateSkillRow(i, 'level', e.target.value)}
              >
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button type="button" onClick={() => removeSkillRow(i)} className="rounded p-2 text-slate-500 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addSkillRow} className="btn-secondary text-xs">
            <Plus size={14} /> Add skill
          </button>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setSkillsModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Skills</button>
          </div>
        </form>
      </Modal>

      <Modal open={completeModal} onClose={() => setCompleteModal(false)} title="Complete today's lesson">
        <form onSubmit={handleComplete} className="space-y-4">
          <div>
            <label className="label">What did you learn? (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Summarize the key takeaway from today's lesson..."
            />
          </div>
          <div>
            <label className="label">Time spent (minutes)</label>
            <input
              type="number"
              min="5"
              max="120"
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCompleteModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={completing} className="btn-primary">
              {completing ? 'Saving...' : 'Complete lesson'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
