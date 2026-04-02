import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { getApiUrl } from '@/lib/api-url';
import {
  ClientInteractionSchema,
  ClientSchema,
  PaginatedResponseSchema,
  UserSchema,
  parseApiArray,
  parseApiObject,
} from '@/lib/schemas';
import type { Client, ClientInteraction, User } from '@/types/api';

const API_URL = getApiUrl();
const PAGE_SIZE = 20;

export type ClientItem = Client;
export type ClientManager = Pick<User, 'id' | 'full_name' | 'role'>;

type ClientsPage = {
  data: ClientItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export function useClients(isTopManager: boolean, userId?: string) {
  const clientsQuery = useInfiniteQuery({
    queryKey: ['clients', { isTopManager, userId, pageSize: PAGE_SIZE }],
    staleTime: 60 * 1000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ClientsPage> => {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      const response = await fetch(`${API_URL}/api/clients?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch clients (${response.status})`);
      }

      const payload =
        parseApiObject(PaginatedResponseSchema, await response.json(), 'clients page') ?? {};

      const rows = parseApiArray(ClientSchema, payload.data ?? [], 'clients page');
      return {
        data: rows,
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor ?? null,
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const metaQuery = useQuery({
    queryKey: ['clients-meta'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{
      interactions: Record<string, number>;
      managers: ClientManager[];
    }> => {
      const [
        { data: interactionRows, error: interactionsError },
        { data: userRows, error: usersError },
      ] = await Promise.all([
        cloudflareApi
          .from('client-interactions')
          .select('client_id,user_id,interaction_type,notes,created_at,id'),
        cloudflareApi.from('users').select('id, full_name, role'),
      ]);

      if (interactionsError) throw interactionsError;
      if (usersError) throw usersError;

      const interactions: Record<string, number> = {};
      for (const row of parseApiArray(
        ClientInteractionSchema,
        interactionRows ?? [],
        'client interactions',
      )) {
        interactions[row.client_id] = (interactions[row.client_id] ?? 0) + 1;
      }

      return {
        interactions,
        managers: parseApiArray(UserSchema, userRows ?? [], 'client managers').map((user) => ({
          id: user.id,
          full_name: user.full_name,
          role: user.role,
        })),
      };
    },
  });

  const clients = useMemo(
    () =>
      (clientsQuery.data?.pages.flatMap((page) => page.data) ?? []).filter((client) =>
        isTopManager || !userId ? true : client.manager_id === userId,
      ),
    [clientsQuery.data, isTopManager, userId],
  );

  return {
    ...clientsQuery,
    clients,
    interactions: metaQuery.data?.interactions ?? {},
    managers: metaQuery.data?.managers ?? [],
    isLoading: clientsQuery.isLoading || metaQuery.isLoading,
  };
}
