import { lazy, Suspense, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart2,
  Building2,
  Eye,
  Handshake,
  Loader2,
  Plus,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReports } from '@/hooks/useReports';
import { getApiUrl } from '@/lib/api-url';
import { ReportsStatsSchema, parseApiObject } from '@/lib/schemas';
import type { Report, ReportsStats } from '@/types/api';
import { toast } from 'sonner';

const ActivityTrendChart = lazy(() =>
  import('@/components/reports/ActivityTrendChart').then((module) => ({
    default: module.ActivityTrendChart,
  })),
);
const ManagerComparisonChart = lazy(() =>
  import('@/components/reports/ManagerComparisonChart').then((module) => ({
    default: module.ManagerComparisonChart,
  })),
);

const API_URL = getApiUrl();

type ChartPeriod = '4w' | '8w' | '12w';
type StatsRow = ReportsStats['deals'][number];

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  'Content-Type': 'application/json',
});

const chartPalette = {
  deals: '#f2be52',
  viewings: '#f59e0b',
  properties: '#38bdf8',
  clients: '#34d399',
};

const chartPeriodOptions: Array<{ value: ChartPeriod; label: string }> = [
  { value: '4w', label: '4 тижні' },
  { value: '8w', label: '8 тижнів' },
  { value: '12w', label: '12 тижнів' },
];

const metricLabels: Record<string, string> = {
  deals: 'Угоди',
  viewings: 'Перегляди',
  properties: "Об'єкти",
  clients: 'Клієнти',
};

const managerMetricLabels: Record<string, string> = {
  properties: "Об'єкти",
  clients: 'Клієнти',
  deals: 'Угоди',
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

const getWeekRange = (offset = 0) => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
};

const getMonthRange = (offset = 0) => {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    start: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`,
    end: last.toISOString().slice(0, 10),
  };
};

const statusConfig = (status: string) =>
  status === 'sent'
    ? { label: 'Надіслано', color: 'bg-blue-100 text-blue-700 border-blue-200' }
    : status === 'reviewed'
      ? { label: 'Переглянуто', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      : { label: 'Чернетка', color: 'bg-slate-100 text-slate-600 border-slate-200' };

const formatWeekLabel = (value: string) => {
  const weekMatch = value.match(/(\d{4})[-/]?[Ww](\d{1,2})/);
  if (weekMatch) return `${Number(weekMatch[2])} тиж.`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
};

const buildActivityChart = (
  deals: StatsRow[],
  properties: ReportsStats['properties'],
  clients: ReportsStats['clients'],
) => {
  const weeks = [...new Set([...deals, ...properties, ...clients].map((row) => row.week))].sort();
  return weeks.map((week) => ({
    week,
    label: formatWeekLabel(week),
    deals: deals
      .filter((row) => row.week === week && row.stage === 'closed')
      .reduce((sum, row) => sum + row.count, 0),
    viewings: deals
      .filter((row) => row.week === week && row.stage === 'viewing')
      .reduce((sum, row) => sum + row.count, 0),
    properties: properties
      .filter((row) => row.week === week)
      .reduce((sum, row) => sum + row.count, 0),
    clients: clients.filter((row) => row.week === week).reduce((sum, row) => sum + row.count, 0),
  }));
};

const chartFallback = (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
  </div>
);

export const ReportsPage = () => {
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const isUk = language === 'uk';
  const isTopManager = role === 'top_manager' || role === 'superuser';
  const isManager = role === 'manager';
  const queryClient = useQueryClient();

  const [selectedManager, setSelectedManager] = useState('all');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('8w');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [periodType, setPeriodType] = useState<'week' | 'month'>('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [summary, setSummary] = useState('');
  const [sendNow, setSendNow] = useState(false);

  const managerFilter = isTopManager && selectedManager !== 'all' ? selectedManager : undefined;
  const reportsQuery = useReports(Boolean(user), managerFilter);
  const reports = reportsQuery.data?.reports ?? [];
  const stats = reportsQuery.data?.stats;
  const periodRange = useMemo(
    () => (periodType === 'week' ? getWeekRange(periodOffset) : getMonthRange(periodOffset)),
    [periodOffset, periodType],
  );

  const activityChart = useMemo(() => {
    if (!stats) return [];
    const rows = buildActivityChart(stats.deals, stats.properties, stats.clients);
    const limit = chartPeriod === '4w' ? 4 : chartPeriod === '8w' ? 8 : 12;
    return rows.slice(-limit);
  }, [chartPeriod, stats]);

  const managerChart = useMemo(
    () =>
      (stats?.managers ?? [])
        .map((manager) => ({
          name: manager.full_name.split(' ')[0],
          fullName: manager.full_name,
          properties: manager.props_30d,
          clients: manager.clients_30d,
          deals: manager.deals_closed_30d,
          total: manager.props_30d + manager.clients_30d + manager.deals_closed_30d,
        }))
        .sort((a, b) => b.total - a.total),
    [stats],
  );

  const managerChartHeight = useMemo(
    () => Math.max(320, managerChart.length * 68),
    [managerChart.length],
  );

  const summaryCards = useMemo(() => {
    const deals =
      stats?.deals
        .filter((row) => row.stage === 'closed')
        .reduce((sum, row) => sum + row.count, 0) ?? 0;
    const viewings =
      stats?.deals
        .filter((row) => row.stage === 'viewing')
        .reduce((sum, row) => sum + row.count, 0) ?? 0;
    const properties = stats?.properties.reduce((sum, row) => sum + row.count, 0) ?? 0;
    const clients = stats?.clients.reduce((sum, row) => sum + row.count, 0) ?? 0;

    return [
      { icon: Building2, label: "Об'єкти", value: properties, color: 'text-sky-300' },
      { icon: Users, label: 'Клієнти', value: clients, color: 'text-emerald-300' },
      { icon: Handshake, label: 'Угоди', value: deals, color: 'text-violet-300' },
      { icon: Eye, label: 'Перегляди', value: viewings, color: 'text-amber-300' },
    ];
  }, [stats]);

  const invalidateReports = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const createReportMutation = useMutation({
    mutationFn: async () => {
      const statsRes = await fetch(
        `${API_URL}/api/reports/stats?period_start=${periodRange.start}&period_end=${periodRange.end}`,
        { headers: authHeaders() },
      );
      const statsData = statsRes.ok
        ? parseApiObject(ReportsStatsSchema, await statsRes.json(), 'report stats')
        : null;

      const body = {
        period_type: periodType,
        period_start: periodRange.start,
        period_end: periodRange.end,
        properties_added: statsData?.properties.reduce((sum, row) => sum + row.count, 0) ?? 0,
        clients_added: statsData?.clients.reduce((sum, row) => sum + row.count, 0) ?? 0,
        deals_closed:
          statsData?.deals
            .filter((row) => row.stage === 'closed')
            .reduce((sum, row) => sum + row.count, 0) ?? 0,
        viewings_done:
          statsData?.deals
            .filter((row) => row.stage === 'viewing')
            .reduce((sum, row) => sum + row.count, 0) ?? 0,
        revenue: 0,
        summary,
        status: sendNow ? 'sent' : 'draft',
      };

      const response = await fetch(`${API_URL}/api/reports`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to create report');
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setSummary('');
      setSendNow(false);
      setPeriodOffset(0);
      await invalidateReports();
      toast.success(sendNow ? 'Звіт надіслано керівнику' : 'Звіт збережено як чернетку');
    },
    onError: (error) => {
      console.error('Create report error:', error);
      toast.error('Не вдалося створити звіт');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          status: 'reviewed',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to review report');
    },
    onSuccess: async () => {
      setViewReport(null);
      await invalidateReports();
      toast.success('Звіт позначено як переглянутий');
    },
    onError: (error) => {
      console.error('Review report error:', error);
      toast.error('Не вдалося оновити статус звіту');
    },
  });

  if (reportsQuery.isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (reportsQuery.isError) {
    return (
      <AppLayout>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-lg font-medium text-destructive">
          {isUk ? 'Не вдалося завантажити звіти' : 'Failed to load reports'}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(242,190,82,0.18),transparent_35%),linear-gradient(180deg,rgba(18,18,18,0.94),rgba(8,8,8,0.94))] p-6 shadow-2xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <BarChart2 className="h-6 w-6 text-amber-300" />
              {isUk ? 'Звіти' : 'Reports'}
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              {isTopManager
                ? 'Аналітика команди та вхідні звіти агентів'
                : 'Ваші результати та звіти для керівника'}
            </p>
          </div>

          {isManager && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="w-fit bg-amber-400 text-black hover:bg-amber-300"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isUk ? 'Створити звіт' : 'Create report'}
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md"
            >
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <p className="mt-4 text-3xl font-semibold text-white">{card.value}</p>
              <p className="mt-1 text-sm text-zinc-400">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {isTopManager && (
              <>
                <Label className="text-zinc-300">Агент:</Label>
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger className="w-64 border-white/10 bg-zinc-950 text-white">
                    <SelectValue placeholder="Всі агенти" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі агенти</SelectItem>
                    {(stats?.managers ?? []).map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {chartPeriodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setChartPeriod(option.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  chartPeriod === option.value
                    ? 'border-amber-300 bg-amber-300/12 text-amber-200'
                    : 'border-white/10 bg-zinc-950 text-zinc-300 hover:border-white/20 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <TrendingUp className="h-5 w-5 text-amber-300" />
              Динаміка активності
            </h2>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-400">
              {chartPeriodOptions.find((option) => option.value === chartPeriod)?.label}
            </span>
          </div>

          <div className="h-80">
            <Suspense fallback={chartFallback}>
              <ActivityTrendChart
                data={activityChart}
                chartPalette={chartPalette}
                metricLabels={metricLabels}
              />
            </Suspense>
          </div>
        </div>

        {isTopManager && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
            <div className="mb-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Users className="h-5 w-5 text-amber-300" />
                Порівняння агентів
              </h2>
            </div>

            <div style={{ height: managerChartHeight }}>
              <Suspense fallback={chartFallback}>
                <ManagerComparisonChart
                  data={managerChart}
                  chartPalette={chartPalette}
                  managerMetricLabels={managerMetricLabels}
                />
              </Suspense>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">
              {isUk ? 'Список звітів' : 'Reports list'}
            </h2>
          </div>

          <div className="grid gap-3">
            {reports.length === 0 && (
              <p className="text-sm text-zinc-500">
                {isUk ? 'Звітів поки немає' : 'No reports yet'}
              </p>
            )}

            {reports.map((report) => {
              const status = statusConfig(report.status);
              return (
                <div key={report.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-sm text-zinc-400">{report.manager_name || '—'}</span>
                      </div>
                      <p className="mt-2 font-medium text-white">
                        {formatDate(report.period_start)} - {formatDate(report.period_end)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {report.summary || (isUk ? 'Без короткого підсумку' : 'No summary')}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-white/10 bg-zinc-950 text-white hover:bg-zinc-900"
                        onClick={() => setViewReport(report)}
                      >
                        {isUk ? 'Переглянути' : 'View'}
                      </Button>
                      {isTopManager && report.status === 'sent' && (
                        <Button
                          className="bg-emerald-500 text-white hover:bg-emerald-400"
                          onClick={() => reviewMutation.mutate(report.id)}
                          disabled={reviewMutation.isPending}
                        >
                          {isUk ? 'Підтвердити' : 'Review'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{isUk ? 'Створити звіт' : 'Create report'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Період</Label>
                  <Select
                    value={periodType}
                    onValueChange={(value: 'week' | 'month') => setPeriodType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Тиждень</SelectItem>
                      <SelectItem value="month">Місяць</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Зсув</Label>
                  <Select
                    value={String(periodOffset)}
                    onValueChange={(value) => setPeriodOffset(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Поточний</SelectItem>
                      <SelectItem value="-1">Попередній</SelectItem>
                      <SelectItem value="-2">Ще раніше</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-300">
                {periodRange.start} - {periodRange.end}
              </div>

              <div className="space-y-2">
                <Label>Підсумок</Label>
                <Textarea
                  rows={6}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="Короткий підсумок за період, ключові результати, проблеми та наступні кроки..."
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendNow}
                  onChange={(event) => setSendNow(event.target.checked)}
                />
                {isUk ? 'Одразу надіслати керівнику' : 'Send immediately to manager'}
              </label>

              <div className="flex justify-end">
                <Button
                  onClick={() => createReportMutation.mutate()}
                  disabled={createReportMutation.isPending}
                  className="bg-amber-400 text-black hover:bg-amber-300"
                >
                  {createReportMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {sendNow ? 'Надіслати' : 'Зберегти'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(viewReport)} onOpenChange={(open) => !open && setViewReport(null)}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{isUk ? 'Перегляд звіту' : 'Report details'}</DialogTitle>
            </DialogHeader>

            {viewReport && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${statusConfig(viewReport.status).color}`}
                  >
                    {statusConfig(viewReport.status).label}
                  </span>
                  <span className="text-sm text-zinc-500">{viewReport.manager_name || '—'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="text-zinc-500">Період</div>
                    <div className="font-medium">
                      {formatDate(viewReport.period_start)} - {formatDate(viewReport.period_end)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-zinc-500">Угоди</div>
                    <div className="font-medium">{viewReport.deals_closed}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-zinc-500">Об'єкти</div>
                    <div className="font-medium">{viewReport.properties_added}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-zinc-500">Клієнти</div>
                    <div className="font-medium">{viewReport.clients_added}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-zinc-500">Перегляди</div>
                    <div className="font-medium">{viewReport.viewings_done}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-zinc-500">Дохід</div>
                    <div className="font-medium">{viewReport.revenue}</div>
                  </div>
                </div>

                <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm">
                  {viewReport.summary || '—'}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
