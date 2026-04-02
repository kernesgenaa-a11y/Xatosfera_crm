import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  KanbanSquare,
  Lightbulb,
  Loader2,
  MapPin,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PropertiesMapWidget } from '@/components/ui/PropertiesMapWidget';
import { useDashboard, type ActivityItem } from '@/hooks/useDashboard';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { z } from 'zod';

const ExchangeRatesSchema = z.array(
  z.object({
    cc: z.string(),
    rate: z.number(),
  }),
);

const AdviceSlipSchema = z.object({
  slip: z.object({
    advice: z.string().min(1),
  }),
});

const FALLBACK_TIPS = [
  {
    text: 'Ніколи не припиняй навчатися. Той, хто зупиняється на досягнутому, залишається позаду.',
    author: 'Генрі Форд',
  },
  {
    text: 'Перше враження клієнта формується за 7 секунд. Зустрічай його з посмішкою та впевненістю.',
    author: 'Поради нерухомості',
  },
  {
    text: 'Найкраща угода та, де виграють обидві сторони. Будуй репутацію чесністю.',
    author: 'Поради нерухомості',
  },
  {
    text: 'Дисципліна важливіша за мотивацію. Мотивація минає, звички залишаються.',
    author: 'Джим Рон',
  },
  {
    text: 'Не можна керувати тим, чого не вимірюєш. Фіксуй кожний дзвінок і кожну зустріч.',
    author: 'Поради нерухомості',
  },
  {
    text: 'Клієнт, який отримав wow-досвід, приведе ще трьох нових клієнтів.',
    author: 'Поради нерухомості',
  },
  {
    text: 'Швидкість відповіді на запит клієнта твоя конкурентна перевага.',
    author: 'Поради нерухомості',
  },
  {
    text: 'Найкращий час посадити дерево 20 років тому. Другий найкращий час зараз.',
    author: 'Китайська мудрість',
  },
];

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

export const DashboardPage = () => {
  const { t, language } = useLanguage();
  const { role, user } = useAuth();
  const isUk = language === 'uk';
  const isManager = role === 'manager';
  const isTopOrSuper = role === 'top_manager' || role === 'superuser';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboardQuery = useDashboard(role, user?.id);

  const stats = dashboardQuery.data?.stats ?? null;
  const activity = dashboardQuery.data?.activity ?? [];
  const mapProperties = dashboardQuery.data?.mapProperties ?? [];
  const loading = dashboardQuery.isLoading;
  const { canInstall, isInstalling, install } = usePwaInstall();

  const [rates, setRates] = useState<{ usd: number | null; eur: number | null; loading: boolean }>({
    usd: null,
    eur: null,
    loading: true,
  });
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [tip, setTip] = useState<{ text: string; author?: string } | null>(null);
  const [tipLoading, setTipLoading] = useState(false);

  const openActivityItem = useCallback(
    (item: ActivityItem) => {
      if (!isTopOrSuper) return;
      if (item.type === 'property') navigate(`/properties/${item.id}`);
      if (item.type === 'client') navigate(`/clients/${item.id}`);
    },
    [isTopOrSuper, navigate],
  );

  useEffect(() => {
    fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json')
      .then((response) => response.json())
      .then((payload) => {
        const data = ExchangeRatesSchema.parse(payload);
        const usd = data.find((row) => row.cc === 'USD');
        const eur = data.find((row) => row.cc === 'EUR');
        setRates({
          usd: usd ? Math.round(usd.rate * 100) / 100 : null,
          eur: eur ? Math.round(eur.rate * 100) / 100 : null,
          loading: false,
        });
      })
      .catch(() => setRates({ usd: null, eur: null, loading: false }));
  }, []);

  const fetchTip = useCallback(async () => {
    setTipLoading(true);

    try {
      const response = await fetch('https://api.adviceslip.com/advice', {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tip');
      }

      const payload = AdviceSlipSchema.parse(await response.json());
      setTip({
        text: payload.slip.advice,
        author: 'Advice Slip API',
      });
    } catch {
      const nextTip = FALLBACK_TIPS[Math.floor(Math.random() * FALLBACK_TIPS.length)];
      setTip(nextTip);
    } finally {
      setTipLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTip();
  }, [fetchTip]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [queryClient]);

  const medalClass = (index: number) =>
    index === 0
      ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
      : index === 1
        ? 'bg-slate-100 text-slate-600 border-slate-300'
        : 'bg-orange-50 text-orange-600 border-orange-200';

  const statCards = [
    {
      title: isManager
        ? isUk
          ? "Мої об'єкти"
          : 'My Properties'
        : isUk
          ? "Всі об'єкти"
          : 'All Properties',
      value: loading ? '…' : (stats?.properties ?? 0),
      icon: Building2,
      color: 'text-blue-500',
    },
    {
      title: isManager
        ? isUk
          ? 'Мої закриті угоди'
          : 'My Closed Deals'
        : isUk
          ? 'Всі закриті угоди'
          : 'All Closed Deals',
      value: loading ? '…' : (stats?.closedDeals ?? 0),
      icon: CheckCircle2,
      color: 'text-green-500',
    },
    {
      title: isManager
        ? isUk
          ? 'Моя конверсія лідів'
          : 'My Lead Conversion'
        : isUk
          ? 'Конверсія лідів'
          : 'Lead Conversion',
      value: loading ? '…' : `${stats?.conversion ?? 0}%`,
      icon: Target,
      color: 'text-violet-500',
    },
  ];

  const quickActions = [
    {
      id: 1,
      name: isUk ? "Створити об'єкт" : 'Create Property',
      path: '/properties/new',
      icon: Building2,
    },
    {
      id: 2,
      name: isUk ? 'Запланувати зустріч' : 'Schedule Meeting',
      path: '/calendar',
      icon: Clock,
    },
    { id: 3, name: isUk ? 'Новий клієнт' : 'New Client', path: '/clients', icon: Users },
    { id: 4, name: isUk ? 'Нова угода' : 'New Deal', path: '/deals', icon: KanbanSquare },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>

          <div className="flex items-center gap-3 rounded-lg border bg-card p-2 px-4 shadow-sm">
            {rates.loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {isUk ? 'Курс НБУ...' : 'Loading...'}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-sm font-bold text-green-600">
                  <DollarSign className="h-4 w-4" />
                  USD: {rates.usd?.toFixed(2) ?? '—'}
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1.5 text-sm font-bold text-blue-600">
                  <span className="text-xs font-bold">€</span>
                  EUR: {rates.eur?.toFixed(2) ?? '—'}
                </div>
                <div className="h-4 w-px bg-border" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  НБУ
                </span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button asChild>
              <Link to="/deals">{t('dashboard.funnel')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/reports">{t('reports.title')}</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {statCards.map((item) => (
            <Card key={item.title}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{item.title}</p>
                  <p className="text-2xl font-bold">{item.value}</p>
                </div>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card
            className={isTopOrSuper ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}
            onClick={() =>
              isTopOrSuper && !loading && activity.length > 0 && setActivityModalOpen(true)
            }
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
                      onOpen={openActivityItem}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
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
                    onOpen={openActivityItem}
                  />
                ))}
              </div>
            </DialogContent>
          </Dialog>

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
                                  ? '€'
                                  : manager.currency === 'UAH'
                                    ? '₴'
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

          <Card className="border-orange-100 bg-orange-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                {isUk ? 'Статус бази даних' : 'Database Status'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isUk ? "Об'єкти без фото" : 'Properties without photos'}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        stats?.noPhoto
                          ? 'border-orange-300 text-orange-600'
                          : 'border-green-300 text-green-600'
                      }
                    >
                      {stats?.noPhoto ?? 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isUk ? 'Клієнти без нотаток' : 'Clients without notes'}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        stats?.noNotes
                          ? 'border-orange-300 text-orange-600'
                          : 'border-green-300 text-green-600'
                      }
                    >
                      {stats?.noNotes ?? 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isUk ? 'Завершені / архів' : 'Completed / archived'}
                    </span>
                    <Badge variant="outline" className="border-slate-300 text-slate-600">
                      {stats?.archived ?? 0}
                    </Badge>
                  </div>
                  <p
                    className={`pt-1 text-xs font-medium ${(stats?.noPhoto ?? 0) === 0 && (stats?.noNotes ?? 0) === 0 ? 'text-green-600' : 'text-orange-600'}`}
                  >
                    {(stats?.noPhoto ?? 0) === 0 && (stats?.noNotes ?? 0) === 0
                      ? `✓ ${isUk ? 'База в порядку' : 'Database is clean'}`
                      : `⚠ ${isUk ? 'Є записи що потребують уваги' : 'Records need attention'}`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {isUk ? 'Швидкі дії' : 'Quick Actions'}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    className="flex h-16 flex-col gap-1.5"
                    asChild
                  >
                    <Link to={action.path}>
                      <action.icon className="h-4 w-4" />
                      <span className="text-center text-xs leading-tight">{action.name}</span>
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-blue-100 bg-gradient-to-br from-indigo-50 to-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-blue-700">
                  <Lightbulb className="h-4 w-4" />
                  {isUk ? 'Порада дня' : 'Tip of the day'}
                  <button
                    onClick={() => void fetchTip()}
                    disabled={tipLoading}
                    className="ml-auto text-blue-400 transition-colors hover:text-blue-600 disabled:opacity-40"
                    title={isUk ? 'Нова порада' : 'New tip'}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${tipLoading ? 'animate-spin' : ''}`} />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tipLoading || !tip ? (
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {isUk ? 'Завантаження...' : 'Loading...'}
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium leading-relaxed text-blue-800">
                      "{tip.text}"
                    </p>
                    {tip.author && (
                      <p className="mt-2 text-right text-xs text-blue-500">— {tip.author}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            <h2 className="text-base font-semibold">
              {isManager
                ? isUk
                  ? "Мої об'єкти на карті"
                  : 'My Properties on Map'
                : isUk
                  ? "Всі об'єкти на карті"
                  : 'All Properties on Map'}
            </h2>
            {!loading && (
              <span className="ml-auto text-xs text-muted-foreground">
                {mapProperties.filter((property) => property.latitude && property.longitude).length}{' '}
                {isUk ? 'позначок' : 'markers'}
              </span>
            )}
          </div>
          {loading ? (
            <div className="flex h-80 items-center justify-center rounded-xl border bg-muted/20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PropertiesMapWidget properties={mapProperties} />
          )}
        </div>

        {canInstall && (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-w-[220px] gap-2 rounded-full px-5"
              onClick={() => void install()}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AppWindow className="h-4 w-4" />
              )}
              {isUk ? 'Встановити застосунок' : 'Install app'}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
