import { useQuery } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { DocumentSchema, parseApiArray } from '@/lib/schemas';

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

export function useDocuments(enabled: boolean) {
  return useQuery({
    queryKey: ['documents'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<DocumentItem[]> => {
      const { data, error } = await cloudflareApi
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return parseApiArray(DocumentSchema, data ?? [], 'documents');
    },
  });
}
