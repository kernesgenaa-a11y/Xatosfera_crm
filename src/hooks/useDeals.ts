import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { getApiUrl } from '@/lib/api-url';
import {
  ClientSchema,
  DealSchema,
  PaginatedResponseSchema,
  PropertySchema,
  parseApiArray,
  parseApiObject,
} from '@/lib/schemas';
import type { Deal, DealClientOption, DealPropertyOption } from '@/types/api';

const API_URL = getApiUrl();
const PAGE_SIZE = 20;

type DealsPage = {
  data: Deal[];
  hasMore: boolean;
  nextCursor: string | null;
};

export function useDeals(role?: string, userId?: string) {
  const dealsQuery = useInfiniteQuery({
    queryKey: ['deals', { role, userId, pageSize: PAGE_SIZE }],
    staleTime: 5 * 60 * 1000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<DealsPage> => {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      const response = await fetch(`${API_URL}/api/deals?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deals (${response.status})`);
      }

      const payload =
        parseApiObject(PaginatedResponseSchema, await response.json(), 'deals page') ?? {};

      return {
        data: parseApiArray(DealSchema, payload.data ?? [], 'deals page'),
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor ?? null,
      };
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const relatedQuery = useQuery({
    queryKey: ['deal-options', { role, userId }],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{
      properties: DealPropertyOption[];
      clients: DealClientOption[];
    }> => {
      const isManager = role === 'manager';
      let propertiesQuery = cloudflareApi.from('properties').select('id,title,address');
      let clientsQuery = cloudflareApi.from('clients').select('id,full_name');

      if (isManager && userId) {
        propertiesQuery = propertiesQuery.eq('manager_id', userId);
        clientsQuery = clientsQuery.eq('manager_id', userId);
      }

      const [
        { data: propertyRows, error: propertiesError },
        { data: clientRows, error: clientsError },
      ] = await Promise.all([propertiesQuery, clientsQuery]);

      if (propertiesError) throw propertiesError;
      if (clientsError) throw clientsError;

      return {
        properties: parseApiArray(PropertySchema, propertyRows ?? [], 'deal properties').map(
          (property) => ({
            id: property.id,
            title: property.title,
            address: property.address,
          }),
        ),
        clients: parseApiArray(ClientSchema, clientRows ?? [], 'deal clients').map((client) => ({
          id: client.id,
          full_name: client.full_name,
        })),
      };
    },
  });

  const deals = useMemo(
    () => dealsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [dealsQuery.data],
  );

  return {
    ...dealsQuery,
    deals,
    properties: relatedQuery.data?.properties ?? [],
    clients: relatedQuery.data?.clients ?? [],
    isLoading: dealsQuery.isLoading || relatedQuery.isLoading,
  };
}
