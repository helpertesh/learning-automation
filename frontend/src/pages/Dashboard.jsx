import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, ClipboardList, Bell, GraduationCap, Timer, AlertTriangle,
  BookMarked, Plus, Calendar, CalendarClock, Brain, Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { formatDateTime, relativeDeadline, deadlineColor, formatMinutes } from '../utils/dates';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiTesting, setAiTesting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.dashboard(),
      api.ai.status().catch(() => null),
    ]).then(([d, ai]) => {
      setData(d);
      setAiStatus(ai);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const testAI = async () => {
    setAiTesting(true);
    try {
      const r = await api.ai.test();
      alert(`AI connected! Model: ${r.model}\nResponse: ${r.response}`);
      setAiStatus((s) => ({ ...s, configured: true }));
    } catch (err) {
      alert(err.message);
    } finally {
      setAiTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const { stats, upcoming, overdue, recentNotes, studyStats, trainingStreak, todayJournal, todayTimetable, quizStats, weakTopics, recentQuizAttempts } = data;

  const statCards = [
    { label: 'Units', value: stats.units, icon: BookOpen, color: 'text-indigo-400', to: '/units' },
    { label: 'Notes', value: stats.notes, icon: FileText, color: 'text-blue-400', to: '/notes' },
    { label: 'Quizzes', value: quizStats?.total_quizzes || 0, icon: Brain, color: 'text-purple-400', to: '/notes' },
    { label: 'Quiz Avg', value: quizStats?.avg_score ? `${quizStats.avg_score}%` : '—', icon: Brain, color: 'text-violet-400', to: '/notes' },
    { label: 'Past Papers', value: stats.past_papers, icon: GraduationCap, color: 'text-purple-400', to: '/past-papers' },
    { label: 'Pending Tasks', value: stats.pending_assignments, icon: ClipboardList, color: 'text-amber-400', to: '/assignments' },
    { label: 'Alerts', value: stats.unread_notifications, icon: Bell, color: 'text-red-400', to: '/notifications' },
    { label: 'Studied Today', value: formatMinutes(studyStats.today_minutes), icon: Timer, color: 'text-emerald-400', to: '/study' },
    { label: 'Training Streak', value: `${trainingStreak}d`, icon: BookMarked, color: 'text-orange-400', to: '/journal' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-slate-500">Overview of your study progress</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/journal" className="btn-primary text-xs"><Plus size={14} /> Log Today</Link>
          <Link to="/assignments" className="btn-secondary text-xs"><ClipboardList size={14} /> Add Task</Link>
          <Link to="/calendar" className="btn-secondary text-xs"><Calendar size={14} /> Calendar</Link>
          <Link to="/exam-prep" className="btn-secondary text-xs"><Brain size={14} /> Exam Prep</Link>
        </div>
      </div>

      {aiStatus && (
        <div className={`card p-4 flex flex-wrap items-center justify-between gap-4 ${aiStatus.configured ? 'border-violet-500/20 bg-violet-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
          <div className="flex items-center gap-3">
            <Sparkles size={20} className={aiStatus.configured ? 'text-violet-400' : 'text-amber-400'} />
            <div>
              {aiStatus.configured ? (
                <>
                  <p className="text-sm font-medium text-violet-300">AI Active — {aiStatus.model}</p>
                  <p className="text-xs text-slate-500">Summaries, quizzes, marking & exam prep use {aiStatus.provider}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-amber-300">AI not configured</p>
                  <p className="text-xs text-slate-500">Add OPENAI_API_KEY to backend/.env and restart the server</p>
                </>
              )}
            </div>
          </div>
          {aiStatus.configured && (
            <button onClick={testAI} disabled={aiTesting} className="btn-secondary text-xs">
              {aiTesting ? 'Testing...' : 'Test AI'}
            </button>
          )}
        </div>
      )}

      {todayTimetable?.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <CalendarClock size={16} className="text-indigo-400" /> Today's Schedule
            </h2>
            <Link to="/timetable" className="text-xs text-indigo-400 hover:underline">Edit timetable</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {todayTimetable.map((s) => (
              <div key={s.id} className="rounded-lg bg-slate-800/50 px-3 py-2 text-sm">
                <span className="text-slate-500">{s.start_time}–{s.end_time}</span>
                <span className="ml-2 text-white">{s.unit_name || s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!todayJournal && (
        <div className="card border-indigo-500/20 bg-indigo-500/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BookMarked size={20} className="text-indigo-400" />
            <p className="text-sm text-indigo-300">You haven't logged today's training yet. Keep your streak going!</p>
          </div>
          <Link to="/journal" className="btn-primary text-xs shrink-0">Write Entry</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="card p-5 transition hover:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{value}</p>
              </div>
              <Icon size={24} className={color} />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {overdue.length > 0 && (
          <section className="card border-red-900/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              <h2 className="font-semibold text-red-400">Overdue Assignments</h2>
            </div>
            <div className="space-y-3">
              {overdue.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-red-500/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-white">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.unit_name}</p>
                  </div>
                  <span className="text-xs text-red-400">{relativeDeadline(a.deadline)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Upcoming Deadlines</h2>
            <Link to="/assignments" className="text-xs text-indigo-400 hover:underline">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming assignments. Add one to get started!</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: a.unit_color }} />
                    <div>
                      <p className="text-sm font-medium text-white">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.unit_name}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${deadlineColor(a.deadline)}`}>
                    {relativeDeadline(a.deadline)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {(weakTopics?.length > 0 || recentQuizAttempts?.length > 0) && (
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-white">
                <Brain size={16} className="text-purple-400" /> Quiz Progress
              </h2>
              <Link to="/notes" className="text-xs text-indigo-400 hover:underline">Go to Notes</Link>
            </div>

            {recentQuizAttempts?.length > 0 && (
              <div className="mb-4 space-y-2">
                {recentQuizAttempts.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{a.quiz_title}</p>
                      <p className="text-xs text-slate-500">{a.unit_name}</p>
                    </div>
                    <span className={`text-sm font-bold ${a.percentage >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {a.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {weakTopics?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-amber-400">Weak Topics — review these</p>
                <div className="space-y-2">
                  {weakTopics.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-amber-500/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.unit_color }} />
                        <span className="text-sm text-white">{t.topic_name}</span>
                      </div>
                      <Link to="/study" className="text-xs text-indigo-400 hover:underline">Study</Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent Notes</h2>
            <Link to="/notes" className="text-xs text-indigo-400 hover:underline">View all</Link>
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-slate-500">No notes uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {recentNotes.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.unit_name}</p>
                  </div>
                  <span className="text-xs text-slate-600">{formatDateTime(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
