import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/api-url';
import { ReportSchema, ReportsStatsSchema, parseApiArray, parseApiObject } from '@/lib/schemas';
import type { Report, ReportsStats } from '@/types/api';

const API_URL = getApiUrl();

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json',
  };
}

export function useReports(enabled: boolean, managerId?: string) {
  return useQuery({
    queryKey: ['reports', { managerId: managerId ?? 'all' }],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{ reports: Report[]; stats: ReportsStats | null }> => {
      const query = managerId ? `?manager_id=${managerId}` : '';
      const [reportsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/reports`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/reports/stats${query}`, { headers: authHeaders() }),
      ]);

      return {
        reports: reportsRes.ok
          ? parseApiArray(ReportSchema, await reportsRes.json(), 'reports')
          : [],
        stats: statsRes.ok
          ? parseApiObject(ReportsStatsSchema, await statsRes.json(), 'reports stats')
          : null,
      };
    },
  });
}
