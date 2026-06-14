import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';

export function formatDate(date) {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date) {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export function relativeDeadline(date) {
  const d = new Date(date);
  if (isToday(d)) return 'Due today';
  if (isTomorrow(d)) return 'Due tomorrow';
  if (isPast(d)) return `Overdue by ${formatDistanceToNow(d)}`;
  return `Due in ${formatDistanceToNow(d)}`;
}

export function deadlineColor(date) {
  const d = new Date(date);
  if (isPast(d)) return 'text-red-400';
  if (isToday(d)) return 'text-amber-400';
  if (isTomorrow(d)) return 'text-yellow-400';
  return 'text-emerald-400';
}

export function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
