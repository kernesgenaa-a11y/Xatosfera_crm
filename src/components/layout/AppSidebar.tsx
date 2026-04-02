import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/contexts/MatchesContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { ProfileSettingsDialog } from '@/components/profile/ProfileSettingsDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Building2,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  CalendarDays,
  FolderOpen,
  KanbanSquare,
  Contact,
  Settings,
  MessageCircle,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuthImage } from '@/hooks/useAuthImage';

const navItems = [
  { key: 'dashboard', label: 'Головна', icon: LayoutDashboard, path: '/dashboard', permission: null },
  { key: 'matches', label: 'Метчі', icon: MessageCircle, path: '/matches', permission: null },
  { key: 'properties', label: 'Об\'єкти', icon: Building2, path: '/properties', permission: null },
  { key: 'clients', label: 'Клієнти', icon: Contact, path: '/clients', permission: null },
  { key: 'deals', label: 'Угоди', icon: KanbanSquare, path: '/deals', permission: null },
  { key: 'calendar', label: 'Календар', icon: CalendarDays, path: '/calendar', permission: null },
  { key: 'tasks', label: 'Завдання', icon: FolderOpen, path: '/notes', permission: null },
  { key: 'reports', label: 'Звіти', icon: FileText, path: '/reports', permission: null },
  { key: 'documents', label: 'Документи', icon: FolderOpen, path: '/documents', permission: null },
  { key: 'users', label: 'Користувачі', icon: Users, path: '/users', permission: 'manage_users' },
];

interface AppSidebarProps {
  onBellClick?: () => void;
}

export const AppSidebar = ({ onBellClick }: AppSidebarProps = {}) => {
  const { profile, role, signOut, hasPermission } = useAuth();
  const { count: matchCount } = useMatches();
  const { unreadCount: unreadNotifCount } = useNotifications();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const getRoleLabel = () => {
    if (role === 'superuser') return 'Суперадмін';
    if (role === 'top_manager') return 'Топ-менеджер';
    return 'Агент';
  };

  const filteredItems = navItems.filter((item) => !item.permission || hasPermission(item.permission));
  
  // Аватар через authenticated fetch (підтримка старого і нового Worker)
  const avatarUrl = useAuthImage(profile?.avatar_url);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-16 bg-[hsl(var(--sidebar-background))] z-50 lg:hidden flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="bg-accent shadow-lg border border-border h-12 w-12 rounded-xl"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
               {mobileOpen ? <X className="h-6 w-6 text-foreground" /> : <Menu className="h-6 w-6 text-foreground" />}
          </Button>
         <div className="p-2">
            <div className="flex items-center gap-3">
              <img src="/angels-logo.png" alt="ANGELS" className="h-10 w-10 object-contain rounded-lg" />
              <div className="justify-center">
                <h1 className="font-bold text-lg text-sidebar-primary">ANGELS</h1>
                <p className="text-xs text-sidebar-primary/60">Агенція Нерухомості</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bell button in mobile header */}
        <button
          onClick={onBellClick}
          className="relative h-10 w-10 rounded-xl bg-accent border border-border shadow-lg flex items-center justify-center transition-colors hover:bg-muted"
          aria-label="Сповіщення"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1 ring-2 ring-primary shadow-md">
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
        </button>
      </div>

      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-[55] lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-[60] w-64 bg-sidebar transform transition-transform duration-300 lg:translate-x-0 h-screen shrink-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo */}
          <div className="p-5 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <img src="/angels-logo.png" alt="ANGELS" className="h-12 w-12 object-contain rounded-lg" />
              <div>
                <h1 className="font-bold text-lg text-sidebar-primary leading-tight">ANGELS</h1>
                <p className="text-xs text-sidebar-primary/60">Агенція Нерухомості</p>
              </div>
            </div>
          </div>

          {/* User Profile */}
          {profile && (
            <div className="p-4 border-b border-sidebar-border">
              <button
               onClick={() => {
        setProfileOpen(true);
        if (window.innerWidth < 1024) {           // або просто setMobileOpen(false)
          setMobileOpen(false);
        }
      }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-left"
              >
                <Avatar className="w-10 h-10">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={profile.full_name} />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
                  <p className="text-xs text-sidebar-foreground/60">{getRoleLabel()}</p>
                </div>
                <Settings className="h-4 w-4 text-sidebar-foreground/40" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group flex items-center gap-4 px-4 py-3 rounded-lg transition-all hover:shadow-sm',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-accent'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5 transition-transform group-hover:scale-110', isActive && 'text-sidebar-primary-foreground')} />
                  <span className="font-medium flex-1">{item.label}</span>
                  {item.key === 'matches' && matchCount > 0 && (
                    <Badge className={cn('h-7 min-w-7 px-1 flex items-center justify-center text-[12px]  bg-yellow-400 text-yellow-900 hover:bg-yellow-400 border-none', isActive && 'bg-red-400 text-red-900 hover:bg-red-500 border-none')}>
                      {matchCount > 99 ? '99+' : matchCount}
                    </Badge>
                  )}
                  {item.key === 'tasks' && unreadNotifCount > 0 && !isActive && (
                    <Badge className="h-7 min-w-7 px-1 flex items-center justify-center text-[12px] bg-red-500 text-white hover:bg-red-500 border-none">
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border">
            <Button 
              variant="ghost" 
              className=" w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" 
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Вийти
            </Button>
          </div>
        </div>
      </aside>

      <ProfileSettingsDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
};
