import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import {
  NoteSchema,
  PaginatedResponseSchema,
  UserSchema,
  parseApiArray,
  parseApiObject,
} from '@/lib/schemas';
import type { Note, NoteManager } from '@/types/api';

const API_URL = getApiUrl();
const PAGE_SIZE = 20;

type NotesPage = {
  data: Note[];
  hasMore: boolean;
  nextCursor: string | null;
};

export function useNotes(isTopManager: boolean, userId?: string) {
  const notesQuery = useInfiniteQuery({
    queryKey: ['notes', { isTopManager, userId, pageSize: PAGE_SIZE }],
    staleTime: 60 * 1000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<NotesPage> => {
      const token = localStorage.getItem('access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      const response = await fetch(`${API_URL}/api/notes?${params.toString()}`, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch notes (${response.status})`);
      }

      const payload =
        parseApiObject(PaginatedResponseSchema, await response.json(), 'notes page') ?? {};

      return {
        data: parseApiArray(NoteSchema, payload.data ?? [], 'notes page'),
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor ?? null,
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const managersQuery = useQuery({
    queryKey: ['note-managers', { userId }],
    enabled: isTopManager,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<NoteManager[]> => {
      const token = localStorage.getItem('access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await fetch(`${API_URL}/api/users`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch users (${response.status})`);
      }

      return parseApiArray(UserSchema, await response.json(), 'users')
        .filter((manager) => manager.id !== userId)
        .map((manager) => ({ id: manager.id, full_name: manager.full_name }));
    },
  });

  const notes = useMemo(
    () => notesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [notesQuery.data],
  );

  return {
    ...notesQuery,
    notes,
    managers: managersQuery.data ?? [],
    isLoading: notesQuery.isLoading || managersQuery.isLoading,
  };
}
