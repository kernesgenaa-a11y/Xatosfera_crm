import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getApiUrl } from '@/lib/api-url';
import { CountResponseSchema, parseApiObject } from '@/lib/schemas';

const API_URL = getApiUrl();

interface MatchesContextType {
  count: number;
  refresh: () => void;
}

const MatchesContext = createContext<MatchesContextType>({ count: 0, refresh: () => {} });

export const MatchesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/matches/count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Matches count API error:', res.status, errorText);
        return;
      }
      const data = parseApiObject(CountResponseSchema, await res.json(), 'matches count') ?? {};
      setCount(data.count ?? 0);
    } catch {
      /* silent */
    }
  }, [user]);

  // Завантажуємо один раз при логіні — без polling
  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  return (
    <MatchesContext.Provider value={{ count, refresh: fetchCount }}>
      {children}
    </MatchesContext.Provider>
  );
};

export const useMatches = () => useContext(MatchesContext);
