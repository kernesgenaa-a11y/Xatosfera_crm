import React, { createContext, useContext, useState, useEffect } from 'react';
import { cloudflareApi } from '@/integrations/cloudflare/client';

export type UserRole = 'superuser' | 'top_manager' | 'manager';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  role?: UserRole;
  phone?: string;
  avatar_url?: string;
  approved?: boolean;
  approved_at?: string;
}

interface AuthContextType {
  user: Profile | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (action: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const { data } = await cloudflareApi.auth.getUser();
      if (data?.user) {
        const u = data.user as Profile;
        setUser(u);
        setRole((u.role as UserRole) ?? null);
      } else {
        setUser(null);
        setRole(null);
      }
    } catch {
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUser(); }, []);

  const signIn = async (email: string, password: string) => {
    await cloudflareApi.auth.signIn(email, password); // throws on error
    await loadUser();
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    await cloudflareApi.auth.signUp(email, password, fullName); // throws on error
    await loadUser();
  };

  const signOut = async () => {
    await cloudflareApi.auth.signOut();
    setUser(null);
    setRole(null);
  };

  const refreshProfile = async () => { await loadUser(); };

  const hasPermission = (action: string): boolean => {
    if (!role) return false;
    const permissions: Record<UserRole, string[]> = {
      superuser: [
        'manage_users', 'manage_all_users', 'manage_reports', 'manage_all_reports',
        'manage_properties', 'manage_all_properties', 'view_all_data',
      ],
      top_manager: [
        'manage_users', 'manage_managers', 'manage_reports', 'manage_all_reports',
        'manage_properties', 'manage_all_properties',
      ],
      manager: ['manage_own_reports', 'manage_own_properties'],
    };
    return permissions[role]?.includes(action) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, profile: user, role, loading, signIn, signUp, signOut, hasPermission, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
