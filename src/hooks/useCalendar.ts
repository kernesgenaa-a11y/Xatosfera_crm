import { useQuery } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { CalendarEventSchema, ClientSchema, PropertySchema, parseApiArray } from '@/lib/schemas';

export interface CalendarEventItem {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  event_type: string;
  status: string;
  property_id: string | null;
  client_id: string | null;
}

export interface CalendarClient {
  id: string;
  full_name: string;
}

export interface CalendarProperty {
  id: string;
  title: string;
  address: string;
}

export function useCalendar(enabled: boolean) {
  return useQuery({
    queryKey: ['calendar'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{
      events: CalendarEventItem[];
      clients: CalendarClient[];
      properties: CalendarProperty[];
    }> => {
      const [{ data: events, error: eventsError }, { data: clients, error: clientsError }, { data: properties, error: propertiesError }] = await Promise.all([
        cloudflareApi.from('calendar-events').select('*').order('starts_at', { ascending: true }),
        cloudflareApi.from('clients').select('id, full_name'),
        cloudflareApi.from('properties').select('id, title, address'),
      ]);

      if (eventsError) throw eventsError;
      if (clientsError) throw clientsError;
      if (propertiesError) throw propertiesError;

      return {
        events: parseApiArray(CalendarEventSchema, events ?? [], 'calendar events'),
        clients: parseApiArray(ClientSchema, clients ?? [], 'clients').map((client) => ({
          id: client.id,
          full_name: client.full_name,
        })),
        properties: parseApiArray(PropertySchema, properties ?? [], 'properties').map((property) => ({
          id: property.id,
          title: property.title,
          address: property.address,
        })),
      };
    },
  });
}
