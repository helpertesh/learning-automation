import { useEffect, useRef } from 'react';
import { api } from '../api/client';

export function useBrowserNotifications() {
  const lastCount = useRef(0);
  const permissionAsked = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (!('Notification' in window)) return;

      if (Notification.permission === 'default' && !permissionAsked.current) {
        permissionAsked.current = true;
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') return;

      try {
        const { count } = await api.notifications.unreadCount();
        if (count > lastCount.current && lastCount.current > 0) {
          const notifications = await api.notifications.list();
          const newest = notifications.find((n) => !n.is_read);
          if (newest) {
            new Notification('StudyFlow — Deadline Alert', {
              body: newest.message,
              icon: '/favicon.svg',
              tag: `studyflow-${newest.id}`,
            });
          }
        }
        lastCount.current = count;
      } catch {
        // API unavailable
      }
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);
}
