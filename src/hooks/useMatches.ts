import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import {
  MatchItemSchema,
  MatchesResponseSchema,
  parseApiArray,
  parseApiObject,
} from '@/lib/schemas';
import type { MatchItem } from '@/types/api';

const API_URL = getApiUrl();

export function useMatches(enabled: boolean) {
  return useQuery({
    queryKey: ['matches'],
    enabled,
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<MatchItem[]> => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Matches API error:', response.status, errorText);
        throw new Error(errorText || `Failed to fetch matches (${response.status})`);
      }

      const data = parseApiObject(MatchesResponseSchema, await response.json(), 'matches') ?? {};
      return parseApiArray(MatchItemSchema, data.matches ?? [], 'matches');
    },
  });
}
