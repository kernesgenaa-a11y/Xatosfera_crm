import { useQuery } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { UserSchema, parseApiArray } from '@/lib/schemas';
import type { User } from '@/types/api';

export type UserWithRole = User;

export function useUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['users'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<UserWithRole[]> => {
      const { data, error } = await cloudflareApi
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        throw error;
      }
      return parseApiArray(UserSchema, data ?? [], 'users');
    },
  });
}
