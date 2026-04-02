import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import {
  DashboardActivityItemSchema,
  DashboardStatsSchema,
  PropertySchema,
  parseApiArray,
  parseApiObject,
} from '@/lib/schemas';
import { MapProperty } from '@/components/ui/PropertiesMapWidget';
import type { DashboardActivityItem, DashboardStats, Property } from '@/types/api';

const API_URL = getApiUrl();

export function useDashboard(role?: string, userId?: string) {
  return useQuery({
    queryKey: ['dashboard', { role, userId }],
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{
      stats: DashboardStats | null;
      activity: DashboardActivityItem[];
      mapProperties: MapProperty[];
    }> => {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      const isManager = role === 'manager';

      const [statsRes, activityRes, propertiesRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/stats`, { headers }),
        fetch(`${API_URL}/api/dashboard/activity`, { headers }),
        fetch(`${API_URL}/api/properties`, { headers }),
      ]);

      const stats = statsRes.ok
        ? parseApiObject(DashboardStatsSchema, await statsRes.json(), 'dashboard stats')
        : null;
      const activity = activityRes.ok
        ? parseApiArray(
            DashboardActivityItemSchema,
            await activityRes.json(),
            'dashboard activity',
          ).slice(0, 20)
        : [];
      const allProperties = propertiesRes.ok
        ? parseApiArray(PropertySchema, await propertiesRes.json(), 'dashboard properties')
        : [];
      const visibleProperties =
        isManager && userId
          ? allProperties.filter((property) => property.manager_id === userId)
          : allProperties;

      const mapProperties = visibleProperties
        .filter((property) => property.latitude && property.longitude)
        .map((property) => ({
          id: property.id,
          title: property.title,
          address:
            [
              property.street,
              property.building_number,
              property.district ? `(${property.district})` : null,
            ]
              .filter(Boolean)
              .join(', ') || property.address,
          latitude: property.latitude,
          longitude: property.longitude,
          price: property.price,
          currency: property.currency,
          category: property.category,
          status: property.status,
        }));

      return { stats, activity, mapProperties };
    },
  });
}
