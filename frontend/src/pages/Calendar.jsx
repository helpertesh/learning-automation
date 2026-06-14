import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { api } from '../api/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';

const priorityDot = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-slate-500' };

export default function Calendar() {
  const [current, setCurrent] = useState(new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const monthStr = format(current, 'yyyy-MM');

  useEffect(() => {
    setLoading(true);
    api.calendar.get(monthStr)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [monthStr]);

  const days = eachDayOfInterval({
    start: startOfMonth(current),
    end: endOfMonth(current),
  });

  const startPad = startOfMonth(current).getDay();
  const padDays = Array.from({ length: startPad }, (_, i) => i);

  const assignmentsByDay = {};
  data?.assignments?.forEach((a) => {
    const day = a.deadline.slice(0, 10);
    if (!assignmentsByDay[day]) assignmentsByDay[day] = [];
    assignmentsByDay[day].push(a);
  });

  const studyByDay = {};
  data?.studySessions?.forEach((s) => { studyByDay[s.day] = s.minutes; });

  const trainingSet = new Set(data?.trainingDays?.map((t) => t.day) || []);

  const selectedAssignments = selected ? assignmentsByDay[selected] || [] : [];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="mt-1 text-slate-500">Deadlines, study sessions, and training days at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(subMonths(current, 1))} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><ChevronLeft size={18} /></button>
          <span className="min-w-[140px] text-center font-semibold text-white">{format(current, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrent(addMonths(current, 1))} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> High priority</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Studied</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-400" /> Training logged</span>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {padDays.map((i) => <div key={`pad-${i}`} className="min-h-[80px] border-b border-r border-slate-800/50 bg-slate-900/30" />)}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayAssignments = assignmentsByDay[key] || [];
            const studied = studyByDay[key];
            const trained = trainingSet.has(key);
            const isSelected = selected === key;

            return (
              <button
                key={key}
                onClick={() => setSelected(isSelected ? null : key)}
                className={`min-h-[80px] border-b border-r border-slate-800/50 p-2 text-left transition hover:bg-slate-800/30 ${
                  isSelected ? 'bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30' : ''
                } ${!isSameMonth(day, current) ? 'opacity-40' : ''}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday(day) ? 'bg-indigo-600 font-bold text-white' : 'text-slate-400'
                }`}>
                  {format(day, 'd')}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayAssignments.slice(0, 2).map((a) => (
                    <div key={a.id} className="flex items-center gap-1 truncate">
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${priorityDot[a.priority]}`} />
                      <span className={`truncate text-[10px] ${a.status === 'completed' ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{a.title}</span>
                    </div>
                  ))}
                  {dayAssignments.length > 2 && (
                    <span className="text-[10px] text-slate-600">+{dayAssignments.length - 2} more</span>
                  )}
                </div>
                <div className="mt-1 flex gap-1">
                  {studied > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title={`${studied}m studied`} />}
                  {trained && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" title="Training logged" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <CalIcon size={16} className="text-indigo-400" />
            {format(new Date(selected + 'T12:00:00'), 'EEEE, MMMM d')}
          </h2>
          {selectedAssignments.length === 0 ? (
            <p className="text-sm text-slate-500">No deadlines on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.unit_color }} />
                    <div>
                      <p className={`text-sm font-medium ${a.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{a.title}</p>
                      <p className="text-xs text-slate-500">{a.unit_name}</p>
                    </div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${
                    a.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                    a.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                  }`}>{a.priority}</span>
                </div>
              ))}
            </div>
          )}
          {studyByDay[selected] > 0 && (
            <p className="mt-3 text-sm text-emerald-400">Studied {studyByDay[selected]} minutes this day</p>
          )}
          {trainingSet.has(selected) && (
            <p className="mt-1 text-sm text-indigo-400">Training journal entry logged</p>
          )}
        </section>
      )}
    </div>
  );
}
