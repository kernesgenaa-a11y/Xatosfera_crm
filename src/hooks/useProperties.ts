import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { getApiUrl } from '@/lib/api-url';
import {
  PaginatedResponseSchema,
  PropertySchema,
  UserSchema,
  parseApiArray,
  parseApiObject,
} from '@/lib/schemas';
import type { Property, User } from '@/types/api';

const API_URL = getApiUrl();
const PAGE_SIZE = 20;

type ManagerLookup = Record<string, string>;

type PropertiesPage = {
  data: Property[];
  hasMore: boolean;
  nextCursor: string | null;
};

export function useProperties(isTopManager: boolean, userId?: string) {
  const propertiesQuery = useInfiniteQuery({
    queryKey: ['properties', { isTopManager, userId, pageSize: PAGE_SIZE }],
    staleTime: 5 * 60 * 1000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<PropertiesPage> => {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      const response = await fetch(`${API_URL}/api/properties?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch properties (${response.status})`);
      }

      const payload =
        parseApiObject(PaginatedResponseSchema, await response.json(), 'properties page') ?? {};

      const rows = parseApiArray(PropertySchema, payload.data ?? [], 'properties page');
      const filteredRows =
        !isTopManager && userId ? rows.filter((property) => property.manager_id === userId) : rows;

      return {
        data: filteredRows,
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor ?? null,
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const managersQuery = useQuery({
    queryKey: ['property-managers'],
    enabled: isTopManager,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ManagerLookup> => {
      const { data, error } = await cloudflareApi.from('users').select('id,full_name');
      if (error) throw error;

      return parseApiArray(UserSchema, data ?? [], 'users').reduce<ManagerLookup>((acc, user) => {
        acc[user.id] = user.full_name;
        return acc;
      }, {});
    },
  });

  const properties = useMemo(
    () => propertiesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [propertiesQuery.data],
  );

  return {
    ...propertiesQuery,
    properties,
    managers: (managersQuery.data ?? {}) as Record<User['id'], string>,
    isLoading: propertiesQuery.isLoading || managersQuery.isLoading,
  };
}
