import { Loader2, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DbStats } from '@/hooks/useDashboard';

const medalClass = (index: number) =>
  index === 0
    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
    : index === 1
      ? 'bg-slate-100 text-slate-600 border-slate-300'
      : 'bg-orange-50 text-orange-600 border-orange-200';

export function TopManagersCard({
  loading,
  stats,
  isUk,
}: {
  loading: boolean;
  stats: DbStats | null;
  isUk: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-yellow-500" />
          {isUk ? 'Топ агентів' : 'Top Managers'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (stats?.topManagers ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {isUk ? 'Закритих угод поки немає' : 'No closed deals yet'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">{isUk ? 'Агент' : 'Agent'}</th>
                <th className="pb-2 text-center font-medium">{isUk ? 'Угоди' : 'Deals'}</th>
                <th className="pb-2 text-right font-medium">{isUk ? 'Сума' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.topManagers ?? []).map((manager, index) => (
                <tr key={manager.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${medalClass(index)}`}
                      >
                        {index + 1}
                      </span>
                      <span className="truncate">{manager.full_name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center font-bold">{manager.closed_count}</td>
                  <td className="py-3 text-right text-xs font-bold text-green-600">
                    {manager.total_amount > 0
                      ? `${Math.round(manager.total_amount).toLocaleString('uk-UA')} ${
                          manager.currency === 'EUR'
                            ? 'EUR'
                            : manager.currency === 'UAH'
                              ? 'грн'
                              : '$'
                        }`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
