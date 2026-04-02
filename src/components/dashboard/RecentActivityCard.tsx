import { Activity, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityItem } from '@/hooks/useDashboard';

function timeAgo(dateStr: string, isUk: boolean): string {
  const diff = Date.now() - new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z')).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 2) return isUk ? 'щойно' : 'just now';
  if (mins < 60) return isUk ? `${mins} хв тому` : `${mins}m ago`;
  if (hours < 24) return isUk ? `${hours} год тому` : `${hours}h ago`;
  return isUk ? `${days} д тому` : `${days}d ago`;
}

function activityLabel(item: ActivityItem, isUk: boolean) {
  if (item.type === 'deal') {
    const map: Record<string, [string, string]> = {
      lead: ['нова угода', 'new deal'],
      viewing: ['перегляд', 'viewing'],
      offer: ['офер', 'offer'],
      deal: ['угода', 'deal'],
      closed: ['закрив угоду', 'closed deal'],
    };
    const [uk, en] = map[item.stage ?? ''] ?? ['оновив угоду', 'updated deal'];
    return isUk ? uk : en;
  }

  if (item.type === 'property') return isUk ? "оновив об'єкт" : 'updated property';
  return isUk ? 'оновив клієнта' : 'updated client';
}

function ActivityRow({
  item,
  isUk,
  isTopOrSuper,
  onOpen,
}: {
  item: ActivityItem;
  isUk: boolean;
  isTopOrSuper: boolean;
  onOpen: (item: ActivityItem) => void;
}) {
  const initials = (item.manager ?? '?')
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex gap-3 border-b pb-3 text-sm last:border-0">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          item.type === 'deal'
            ? 'bg-green-100 text-green-700'
            : item.type === 'property'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-violet-100 text-violet-700'
        }`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-snug">
          <span className="font-medium text-foreground">{item.manager ?? '—'}</span>{' '}
          <span className="text-muted-foreground">{activityLabel(item, isUk)}</span>{' '}
          {isTopOrSuper && item.type !== 'deal' ? (
            <button
              type="button"
              className="text-foreground underline-offset-2 hover:underline"
              onClick={() => onOpen(item)}
            >
              {item.title}
            </button>
          ) : (
            <span className="text-foreground">{item.title}</span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(item.updated_at, isUk)}</p>
      </div>
    </div>
  );
}

export function RecentActivityCard({
  loading,
  activity,
  isUk,
  isTopOrSuper,
  open,
  onOpenChange,
  onOpenItem,
}: {
  loading: boolean;
  activity: ActivityItem[];
  isUk: boolean;
  isTopOrSuper: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenItem: (item: ActivityItem) => void;
}) {
  return (
    <>
      <Card
        className={isTopOrSuper ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}
        onClick={() => isTopOrSuper && !loading && activity.length > 0 && onOpenChange(true)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-orange-500" />
            {isUk ? 'Остання активність' : 'Recent Activity'}
            {isTopOrSuper && !loading && activity.length > 5 && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {isUk ? 'Натисни щоб побачити всі' : 'Click to see all'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activity.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {isUk ? 'Активності поки немає' : 'No activity yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {activity.slice(0, 5).map((item) => (
                <ActivityRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  isUk={isUk}
                  isTopOrSuper={isTopOrSuper}
                  onOpen={onOpenItem}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[80vh] max-w-lg overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              {isUk ? 'Остання активність команди' : 'Team Activity'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {activity.map((item) => (
              <ActivityRow
                key={`modal-${item.type}-${item.id}`}
                item={item}
                isUk={isUk}
                isTopOrSuper={isTopOrSuper}
                onOpen={onOpenItem}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
