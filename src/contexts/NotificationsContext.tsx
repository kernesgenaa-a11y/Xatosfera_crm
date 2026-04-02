import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api-url';
import { NotificationSchema, parseApiArray } from '@/lib/schemas';
import type { Notification } from '@/types/api';

const API_URL = getApiUrl();

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  refresh: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  refresh: () => {},
  markRead: () => {},
  markAllRead: () => {},
});

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetch_ = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setNotifications(parseApiArray(NotificationSchema, await res.json(), 'notifications'));
    } catch {
      /* silent */
    }
  }, [user]);

  // OPT: poll every 2 minutes (was 30s), and skip when tab is not visible
  useEffect(() => {
    void fetch_();
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void fetch_();
    }, 120_000);
    return () => clearInterval(iv);
  }, [fetch_]);

  const markRead = useCallback(async (id: string) => {
    const token = localStorage.getItem('access_token');
    await fetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  }, []);

  const markAllRead = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, refresh: fetch_, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
