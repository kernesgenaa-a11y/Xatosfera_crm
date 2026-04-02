import { useQuery } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { getApiUrl } from '@/lib/api-url';
import {
  CalendarEventSchema,
  ChangeHistorySchema,
  ClientInteractionSchema,
  ClientSchema,
  UserSchema,
  parseApiArray,
} from '@/lib/schemas';
import type {
  ChangeHistory,
  Client,
  ClientCalendarEvent,
  ClientInteraction,
  ClientManager,
} from '@/types/api';

const API_URL = getApiUrl();

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json',
  };
}

export function useClientDetail(id?: string) {
  return useQuery({
    queryKey: ['client-detail', id],
    enabled: Boolean(id),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{
      client: Client | null;
      interactions: ClientInteraction[];
      events: ClientCalendarEvent[];
      managers: ClientManager[];
      history: ChangeHistory[];
    }> => {
      const [
        { data: clientRows, error: clientError },
        { data: userRows, error: usersError },
        interactionsRes,
        eventsRes,
        historyRes,
      ] = await Promise.all([
        cloudflareApi.from('clients').select('*').eq('id', id),
        cloudflareApi.from('users').select('id, full_name'),
        fetch(`${API_URL}/api/client-interactions?client_id=${id}`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/calendar-events?client_id=${id}`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/clients/${id}/history`, { headers: authHeaders() }),
      ]);

      if (clientError) throw clientError;
      if (usersError) throw usersError;

      const client = parseApiArray(ClientSchema, clientRows ?? [], 'client detail')[0] ?? null;
      const managers = parseApiArray(UserSchema, userRows ?? [], 'client detail managers');
      const interactions = interactionsRes.ok
        ? parseApiArray(
            ClientInteractionSchema,
            await interactionsRes.json(),
            'client interactions',
          )
        : [];
      const events = eventsRes.ok
        ? parseApiArray(CalendarEventSchema, await eventsRes.json(), 'client events')
        : [];
      const history = historyRes.ok
        ? parseApiArray(ChangeHistorySchema, await historyRes.json(), 'client history')
        : [];

      return {
        client,
        managers,
        interactions,
        events: events.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description ?? null,
          starts_at: event.starts_at,
          event_type: event.event_type,
          status: event.status,
        })),
        history,
      };
    },
  });
}
