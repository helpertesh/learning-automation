import { useEffect, useState } from 'react';
import { Bell, CheckCheck, MessageCircle, Send } from 'lucide-react';
import { api } from '../api/client';
import EmptyState from '../components/EmptyState';
import { formatDateTime } from '../utils/dates';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState(null);
  const [waTesting, setWaTesting] = useState(false);

  const load = () => {
    Promise.all([
      api.notifications.list(),
      api.whatsapp.status().catch(() => null),
    ]).then(([n, wa]) => {
      setNotifications(n);
      setWaStatus(wa);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markRead = async (id) => {
    await api.notifications.markRead(id);
    load();
  };

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    load();
  };

  const testWhatsApp = async () => {
    setWaTesting(true);
    try {
      await api.whatsapp.test();
      alert('Test message sent! Check Telegram or WhatsApp.');
    } catch (err) {
      alert(err.message);
    } finally {
      setWaTesting(false);
    }
  };

  const sendDigest = async () => {
    setWaTesting(true);
    try {
      const r = await api.whatsapp.sendDigest();
      if (r.sent) alert('Daily digest sent!');
      else alert(r.reason || 'Could not send');
    } catch (err) {
      alert(err.message);
    } finally {
      setWaTesting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /></div>;
  }

  const unread = notifications.filter((n) => !n.is_read);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="mt-1 text-slate-500">Deadline reminders — also sent to Telegram or WhatsApp when configured</p>
        </div>
        {unread.length > 0 && (
          <button onClick={markAllRead} className="btn-secondary"><CheckCheck size={16} /> Mark all read</button>
        )}
      </div>

      <div className="card border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <MessageCircle size={22} className="mt-0.5 text-emerald-400" />
            <div>
              <h2 className="font-semibold text-white">Telegram / WhatsApp Alerts</h2>
              {waStatus?.enabled ? (
                <p className="mt-1 text-sm text-emerald-300">
                  Connected: {waStatus.channels?.join(', ')} · Daily digest at {waStatus.digest_hour}:00
                </p>
              ) : (
                <div className="mt-1 text-sm text-slate-400 space-y-1">
                  <p>CallMeBot WhatsApp is often full. Use <strong className="text-emerald-400">Telegram</strong> instead (free, instant).</p>
                  <p>Setup in <code className="text-emerald-400">backend/.env</code> — see <code className="text-emerald-400">.env.example</code></p>
                </div>
              )}
              <ul className="mt-2 text-xs text-slate-500 space-y-0.5">
                <li>• Assignment deadlines & overdue alerts</li>
                <li>• Quiz results & weak topics</li>
                <li>• Daily study digest (schedule, weak topics, study time)</li>
              </ul>
            </div>
          </div>
          {waStatus?.enabled && (
            <div className="flex gap-2">
              <button onClick={testWhatsApp} disabled={waTesting} className="btn-secondary text-xs">
                <Send size={14} /> Test
              </button>
              <button onClick={sendDigest} disabled={waTesting} className="btn-primary text-xs">
                Send Digest Now
              </button>
            </div>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You'll receive alerts when assignment deadlines are approaching."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`card cursor-pointer p-4 transition hover:border-slate-700 ${
                !n.is_read ? 'border-indigo-500/30 bg-indigo-500/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {!n.is_read && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />}
                  <div>
                    <p className={`text-sm ${n.is_read ? 'text-slate-400' : 'font-medium text-white'}`}>{n.message}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {n.assignment_title} &middot; Due {formatDateTime(n.deadline)}
                    </p>
                  </div>
                </div>
                <span className="flex-shrink-0 text-xs text-slate-600">{formatDateTime(n.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
