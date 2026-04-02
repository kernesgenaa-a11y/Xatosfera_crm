import { ReactNode, useEffect, useRef, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { ChevronUp, Bell, CheckCheck, X, ClipboardList, FileText } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNavigate } from 'react-router-dom';
import bgImage from '@/assets/6.png';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();
  const navigate = useNavigate();

  // Scroll-to-top detection
  useEffect(() => {
    const main = document.getElementById('main-scroll');
    if (!main) return;
    const onScroll = () => setShowScrollTop(main.scrollTop > 300);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // Refresh when opening panel
  const openPanel = () => {
    refresh();
    setNotifOpen((o) => !o);
  };

  const scrollTop = () =>
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });

  const handleNotifClick = async (n: (typeof notifications)[0]) => {
    if (!n.is_read) await markRead(n.id);
    setNotifOpen(false);
    if (n.entity_type === 'note') navigate('/notes');
    else if (n.entity_type === 'deal') navigate('/deals');
    else if (n.entity_type === 'client') navigate(`/clients/${n.entity_id}`);
    else if (n.entity_type === 'property') navigate(`/properties/${n.entity_id}`);
  };

  const isTask = (n: (typeof notifications)[0]) => n.entity_type === 'note';

  return (
    <div className="h-screen flex overflow-hidden">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <AppSidebar onBellClick={openPanel} />

      <main
        id="main-scroll"
        className="flex-1 overflow-y-auto overflow-x-hidden relative mt-16 lg:mt-0"
      >
        <div className="container py-6 lg:py-8 px-4 lg:px-8 max-w-7xl">{children}</div>
      </main>

      {/* ── Notifications panel wrapper ── */}
      <div ref={panelRef} className="fixed z-[70]" style={{ top: 0, right: 0 }}>
        {/* Bell trigger – desktop only */}

        <button
          onClick={openPanel}
          className="hidden lg:flex relative mt-4 mr-6 w-10 h-10 rounded-xl bg-accent border border-border shadow-lg items-center justify-center hover:bg-muted transition-colors"
          aria-label="Сповіщення"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1 ring-2 ring-primary shadow-md">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Panel – visible on all screen sizes */}
        {notifOpen && (
          <div className="absolute top-[64px] right-4 lg:top-[56px] lg:right-6 w-80 max-h-[70vh] bg-card border rounded-xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Сповіщення</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Позначити всі як прочитані"
                  >
                    <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                <button
                  onClick={() => setNotifOpen(false)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  Немає сповіщень
                </div>
              ) : (
                notifications.map((n) => {
                  const unread = !n.is_read;
                  const Icon = isTask(n) ? ClipboardList : FileText;
                  const iconColor =
                    n.type === 'assignment'
                      ? 'text-blue-600 bg-blue-50'
                      : n.message.includes('Виконано')
                        ? 'text-green-600 bg-green-50'
                        : n.message.includes('виконано')
                          ? 'text-red-500 bg-red-50'
                          : 'text-primary bg-primary/10';
                  return (
                    <div
                      key={n.id}
                      onClick={() => void handleNotifClick(n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0 ${unread ? 'bg-primary/5' : ''}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p
                            className={`text-sm leading-snug ${unread ? 'font-semibold' : 'font-medium'}`}
                          >
                            {n.title}
                          </p>
                          {unread && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(n.created_at).toLocaleString('uk-UA', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Scroll to top ── */}
      <button
        onClick={scrollTop}
        aria-label="Вгору"
        className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all duration-300 ease-in-out hover:bg-primary/90 hover:scale-110 hover:-translate-y-0.5 active:scale-95 ${showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </div>
  );
};
