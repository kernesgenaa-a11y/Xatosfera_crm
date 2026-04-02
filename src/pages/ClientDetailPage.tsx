import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { useClientDetail } from '@/hooks/useClientDetail';
import { getApiUrl } from '@/lib/api-url';
import type { ClientInteraction } from '@/types/api';
import { toast } from 'sonner';

const API_URL = getApiUrl();

const INTERACTION_TYPES = [
  {
    value: 'call',
    label: 'Дзвінок',
    icon: PhoneCall,
    calendar: true,
    duration: 30,
    accent: 'text-emerald-400',
  },
  {
    value: 'meeting',
    label: 'Зустріч',
    icon: Calendar,
    calendar: true,
    duration: 60,
    accent: 'text-sky-400',
  },
  {
    value: 'showing',
    label: 'Показ',
    icon: Home,
    calendar: true,
    duration: 60,
    accent: 'text-amber-300',
  },
  {
    value: 'message',
    label: 'Повідомлення',
    icon: MessageSquare,
    calendar: false,
    duration: 15,
    accent: 'text-violet-400',
  },
  {
    value: 'other',
    label: 'Інше',
    icon: FileText,
    calendar: false,
    duration: 30,
    accent: 'text-zinc-300',
  },
] as const;

const SEGMENT_LABELS: Record<string, string> = {
  buyer: 'Покупець',
  seller: 'Продавець',
  tenant: 'Орендар',
  landlord: 'Орендодавець',
};
const SEGMENT_BADGES: Record<string, string> = {
  buyer: 'bg-blue-100 text-blue-700 border-blue-200',
  seller: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  tenant: 'bg-amber-100 text-amber-700 border-amber-200',
  landlord: 'bg-violet-100 text-violet-700 border-violet-200',
};
const PROPERTY_LABELS: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Будинок',
  commercial: 'Комерція',
  land_plot: 'Ділянка',
  other: 'Інше',
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  'Content-Type': 'application/json',
});
const formatDate = (value: string) =>
  new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const toDatetimeLocal = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const formatMoney = (value: number | null, currency: string | null) =>
  value == null
    ? '—'
    : `${value.toLocaleString('uk-UA')} ${currency === 'USD' ? '$' : currency === 'EUR' ? 'EUR' : 'грн'}`;
const formatRooms = (from: number | null, to: number | null) =>
  from == null && to == null
    ? '—'
    : from != null && to != null && from !== to
      ? `${from}-${to}`
      : String(from ?? to);

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(28,28,30,0.72),rgba(16,16,18,0.88))] p-4 backdrop-blur-md">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function InteractionCard({
  interaction,
  label,
  author,
  accent,
  canDelete,
  onDelete,
}: {
  interaction: ClientInteraction;
  label: string;
  author: string;
  accent: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const Icon =
    INTERACTION_TYPES.find((item) => item.value === interaction.interaction_type)?.icon ?? FileText;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-black/40 p-2">
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-white">{label}</p>
            <span className="text-xs text-zinc-500">{author}</span>
            <span className="ml-auto text-xs text-zinc-500">
              {formatDate(interaction.created_at)}
            </span>
          </div>
          {interaction.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{interaction.notes}</p>
          )}
        </div>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-zinc-400 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Видалити взаємодію?</AlertDialogTitle>
                <AlertDialogDescription>Цю дію неможливо скасувати.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Видалити
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

export const ClientDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const isUk = language === 'uk';
  const isTopManager = role === 'top_manager' || role === 'superuser';
  const queryClient = useQueryClient();
  const detailQuery = useClientDetail(id);
  const detail = detailQuery.data;
  const client = detail?.client ?? null;
  const interactions = detail?.interactions ?? [];
  const events = detail?.events ?? [];
  const managers = detail?.managers ?? [];
  const history = detail?.history ?? [];
  const [editOpen, setEditOpen] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [form, setForm] = useState({
    type: 'call',
    notes: '',
    scheduledAt: toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
    duration: '30',
    createCalendar: true,
  });

  const canEdit = Boolean(
    client &&
    user &&
    (isTopManager || client.manager_id === user.id || client.created_by === user.id),
  );
  const managerName = (managerId: string | null) =>
    managers.find((item) => item.id === managerId)?.full_name ?? '—';
  const userName = (userId: string) =>
    managers.find((item) => item.id === userId)?.full_name ?? '—';

  const stats = useMemo(() => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const upcoming =
      [...events]
        .filter(
          (event) =>
            new Date(event.starts_at).getTime() >= Date.now() && event.status !== 'cancelled',
        )
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ??
      null;
    return {
      total: interactions.length,
      month: interactions.filter((item) => new Date(item.created_at).getTime() >= monthAgo).length,
      calls: interactions.filter((item) => item.interaction_type === 'call').length,
      meetings: interactions.filter((item) => item.interaction_type === 'meeting').length,
      showings: interactions.filter((item) => item.interaction_type === 'showing').length,
      last: interactions[0] ?? null,
      upcoming,
    };
  }, [events, interactions]);

  const invalidateDetail = async () => {
    await queryClient.invalidateQueries({ queryKey: ['client-detail', id] });
  };
  const addInteractionMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing client id');
      const preset = INTERACTION_TYPES.find((item) => item.value === form.type);
      const payload: Record<string, unknown> = {
        client_id: id,
        interaction_type: form.type,
        notes: form.notes || null,
      };
      if (form.createCalendar) {
        const startsAt = new Date(form.scheduledAt);
        const endsAt = new Date(startsAt.getTime() + Number(form.duration || 30) * 60 * 1000);
        payload.create_calendar_event = true;
        payload.starts_at = startsAt.toISOString();
        payload.ends_at = endsAt.toISOString();
        payload.calendar_title = `${client?.full_name ?? 'Клієнт'}: ${preset?.label ?? form.type}`;
      }
      const response = await fetch(`${API_URL}/api/client-interactions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Create interaction failed');
    },
    onSuccess: async () => {
      const preset = INTERACTION_TYPES.find((item) => item.value === form.type);
      setForm({
        type: form.type,
        notes: '',
        scheduledAt: toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
        duration: String(preset?.duration ?? 30),
        createCalendar: preset?.calendar ?? false,
      });
      await invalidateDetail();
      toast.success(isUk ? 'Взаємодію додано' : 'Interaction created');
    },
    onError: (error) => {
      console.error('Create interaction error:', error);
      toast.error(isUk ? 'Не вдалося додати взаємодію' : 'Failed to create interaction');
    },
  });
  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      const response = await fetch(`${API_URL}/api/client-interactions/${interactionId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Delete interaction failed');
    },
    onSuccess: async () => {
      await invalidateDetail();
      toast.success(isUk ? 'Взаємодію видалено' : 'Interaction deleted');
    },
    onError: () =>
      toast.error(isUk ? 'Не вдалося видалити взаємодію' : 'Failed to delete interaction'),
  });
  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing client id');
      const { error } = await cloudflareApi
        .from('clients')
        .update({ notes: editNotes || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditOpen(false);
      await invalidateDetail();
      toast.success(isUk ? 'Нотатки оновлено' : 'Notes updated');
    },
    onError: (error) => {
      console.error('Save notes error:', error);
      toast.error(isUk ? 'Не вдалося зберегти нотатки' : 'Failed to save notes');
    },
  });
  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('Missing client');
      const nextStatus = (client.status ?? 'active') === 'archived' ? 'active' : 'archived';
      const { error } = await cloudflareApi
        .from('clients')
        .update({ status: nextStatus })
        .eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateDetail();
      toast.success(
        client?.status === 'archived'
          ? isUk
            ? 'Клієнта відновлено'
            : 'Client restored'
          : isUk
            ? 'Клієнта перенесено в архів'
            : 'Client archived',
      );
    },
    onError: (error) => {
      console.error('Archive toggle error:', error);
      toast.error(isUk ? 'Не вдалося оновити статус клієнта' : 'Failed to update client status');
    },
  });

  const applyQuickAction = (type: string) => {
    const preset = INTERACTION_TYPES.find((item) => item.value === type);
    setForm((prev) => ({
      ...prev,
      type,
      createCalendar: preset?.calendar ?? false,
      duration: String(preset?.duration ?? prev.duration),
    }));
    document
      .getElementById('client-interaction-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (detailQuery.isLoading)
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  if (detailQuery.isError)
    return (
      <AppLayout>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-lg font-medium text-destructive">
          {isUk ? 'Не вдалося завантажити сторінку клієнта' : 'Failed to load client page'}
        </div>
      </AppLayout>
    );
  if (!client)
    return (
      <AppLayout>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-lg font-medium">
          {isUk ? 'Клієнта не знайдено' : 'Client not found'}
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(242,190,82,0.18),transparent_35%),linear-gradient(180deg,rgba(18,18,18,0.94),rgba(8,8,8,0.94))] p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="w-fit text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <Link to="/clients">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {isUk ? 'Назад до клієнтів' : 'Back to clients'}
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-white">{client.full_name}</h1>
                <Badge
                  className={
                    SEGMENT_BADGES[client.segment] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                  }
                >
                  {SEGMENT_LABELS[client.segment] ?? client.segment}
                </Badge>
                {(client.status ?? 'active') === 'archived' && (
                  <Badge
                    variant="outline"
                    className="border-slate-400/40 bg-slate-500/10 text-slate-300"
                  >
                    {isUk ? 'Архів' : 'Archive'}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-amber-300" />
                  {client.phone || '—'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-300" />
                  {client.district || '—'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-300" />
                  {managerName(client.manager_id)}
                </span>
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => {
                    setEditNotes(client.notes ?? '');
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {isUk ? 'Нотатки' : 'Notes'}
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {(client.status ?? 'active') === 'archived'
                    ? isUk
                      ? 'Відновити'
                      : 'Restore'
                    : isUk
                      ? 'В архів'
                      : 'Archive'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          {[
            {
              label: isUk ? 'Усього взаємодій' : 'Total interactions',
              value: stats.total,
              note: isUk ? 'Повна історія клієнта' : 'Full client history',
            },
            {
              label: isUk ? 'За 30 днів' : 'Last 30 days',
              value: stats.month,
              note: isUk ? 'Поточна активність' : 'Current activity',
            },
            {
              label: isUk ? 'Останній контакт' : 'Last contact',
              value: stats.last ? formatDate(stats.last.created_at) : '—',
              note: stats.last?.interaction_type ?? (isUk ? 'Немає записів' : 'No records'),
            },
            {
              label: isUk ? 'Наступна подія' : 'Next event',
              value: stats.upcoming ? formatDate(stats.upcoming.starts_at) : '—',
              note: stats.upcoming?.title ?? (isUk ? 'Подій не заплановано' : 'No upcoming events'),
            },
          ].map((item) => (
            <Card key={item.label} className="border-white/10 bg-black/40 backdrop-blur-md">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-300/75">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-sm text-zinc-400">{item.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-6">
            <Card className="border-white/10 bg-black/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">
                  {isUk ? 'Профіль клієнта' : 'Client profile'}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <InfoBox
                  label={isUk ? 'Бюджет' : 'Budget'}
                  value={formatMoney(client.budget, client.currency)}
                />
                <InfoBox
                  label={isUk ? 'Тип запиту' : 'Property type'}
                  value={PROPERTY_LABELS[client.property_type ?? ''] ?? client.property_type ?? '—'}
                />
                <InfoBox
                  label={isUk ? 'Кімнатність' : 'Rooms'}
                  value={formatRooms(client.rooms_from, client.rooms_to)}
                />
                <InfoBox
                  label={isUk ? 'Сотки' : 'Land area'}
                  value={
                    client.property_type === 'land_plot'
                      ? String(client.land_area_sotky ?? '—')
                      : '—'
                  }
                />
                <InfoBox
                  label={isUk ? 'Створено' : 'Created'}
                  value={formatDate(client.created_at)}
                />
                <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(28,28,30,0.78),rgba(14,14,16,0.92))] p-4 backdrop-blur-md md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {isUk ? 'Нотатки' : 'Notes'}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                    {client.notes || (isUk ? 'Нотаток поки немає' : 'No notes yet')}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-black/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">
                  {isUk ? 'Швидкі дії' : 'Quick actions'}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {INTERACTION_TYPES.filter((item) => item.value !== 'other').map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all hover:border-amber-300/40 hover:bg-white/[0.08]"
                    onClick={() => applyQuickAction(item.value)}
                  >
                    <item.icon className={`h-5 w-5 ${item.accent}`} />
                    <p className="mt-3 font-medium text-white">{item.label}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {item.calendar
                        ? isUk
                          ? 'Підготує подію в календарі'
                          : 'Creates a calendar event'
                        : isUk
                          ? 'Швидкий запис в історію'
                          : 'Quick history note'}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card
              id="client-interaction-form"
              className="border-white/10 bg-black/40 backdrop-blur-md"
            >
              <CardHeader>
                <CardTitle className="text-white">
                  {isUk ? 'Додати взаємодію' : 'Add interaction'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wide text-zinc-500">
                      {isUk ? 'Тип дії' : 'Type'}
                    </label>
                    <Select
                      value={form.type}
                      onValueChange={(value) => {
                        const preset = INTERACTION_TYPES.find((item) => item.value === value);
                        setForm((prev) => ({
                          ...prev,
                          type: value,
                          createCalendar: preset?.calendar ?? prev.createCalendar,
                          duration: String(preset?.duration ?? prev.duration),
                        }));
                      }}
                    >
                      <SelectTrigger className="border-white/10 bg-zinc-950 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERACTION_TYPES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wide text-zinc-500">
                      {isUk ? 'Коментар' : 'Comment'}
                    </label>
                    <Textarea
                      rows={3}
                      className="border-white/10 bg-zinc-950 text-white placeholder:text-zinc-500"
                      placeholder={
                        isUk
                          ? 'Що саме відбулося або що потрібно зробити?'
                          : 'What happened or what should happen next?'
                      }
                      value={form.notes}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {isUk ? "Прив'язати до календаря" : 'Link to calendar'}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {isUk
                          ? 'Для дзвінка, зустрічі або показу краще одразу поставити час і тривалість.'
                          : 'Calls, meetings, and showings work better with a scheduled time.'}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={form.createCalendar}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, createCalendar: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border-white/20 accent-amber-400"
                      />
                      {isUk ? 'Створити подію' : 'Create event'}
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wide text-zinc-500">
                        {isUk ? 'Дата і час' : 'Date and time'}
                      </label>
                      <Input
                        type="datetime-local"
                        className="border-white/10 bg-black/40 text-white"
                        value={form.scheduledAt}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, scheduledAt: event.target.value }))
                        }
                        disabled={!form.createCalendar}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wide text-zinc-500">
                        {isUk ? 'Тривалість, хв' : 'Duration, min'}
                      </label>
                      <Input
                        type="number"
                        min="5"
                        step="5"
                        className="border-white/10 bg-black/40 text-white"
                        value={form.duration}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, duration: event.target.value }))
                        }
                        disabled={!form.createCalendar}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => addInteractionMutation.mutate()}
                    disabled={addInteractionMutation.isPending}
                    className="min-w-44 bg-amber-400 text-black hover:bg-amber-300"
                  >
                    {addInteractionMutation.isPending ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        {isUk ? 'Збереження...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        {form.createCalendar
                          ? isUk
                            ? 'Додати і в календар'
                            : 'Add and schedule'
                          : isUk
                            ? 'Додати в історію'
                            : 'Add to history'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-white/10 bg-black/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">
                  {isUk ? 'Статистика взаємодій' : 'Interaction stats'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: isUk ? 'Дзвінки' : 'Calls', value: stats.calls },
                  { label: isUk ? 'Зустрічі' : 'Meetings', value: stats.meetings },
                  { label: isUk ? 'Покази' : 'Showings', value: stats.showings },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <span className="text-sm text-zinc-300">{item.label}</span>
                    <span className="text-lg font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-black/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">
                  {isUk ? 'Майбутні події' : 'Upcoming events'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...events]
                  .filter(
                    (event) =>
                      new Date(event.starts_at).getTime() >= Date.now() &&
                      event.status !== 'cancelled',
                  )
                  .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                  .slice(0, 6)
                  .map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{event.title}</p>
                        <Badge
                          variant="outline"
                          className="border-amber-300/30 bg-amber-300/10 text-amber-200"
                        >
                          {event.event_type}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-zinc-300">{formatDate(event.starts_at)}</p>
                      {event.description && (
                        <p className="mt-1 text-sm text-zinc-500">{event.description}</p>
                      )}
                    </div>
                  ))}
                {events.filter(
                  (event) =>
                    new Date(event.starts_at).getTime() >= Date.now() &&
                    event.status !== 'cancelled',
                ).length === 0 && (
                  <p className="text-sm text-zinc-500">
                    {isUk ? 'Наразі запланованих подій немає' : 'No upcoming events'}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-black/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">
                  {isUk
                    ? `Історія взаємодій (${interactions.length})`
                    : `Interaction history (${interactions.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {interactions.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    {isUk ? 'Взаємодій ще немає' : 'No interactions yet'}
                  </p>
                )}
                {interactions.map((interaction) => {
                  const type = INTERACTION_TYPES.find(
                    (item) => item.value === interaction.interaction_type,
                  );
                  return (
                    <InteractionCard
                      key={interaction.id}
                      interaction={interaction}
                      label={type?.label ?? (isUk ? 'Інше' : 'Other')}
                      author={userName(interaction.user_id)}
                      accent={type?.accent ?? 'text-zinc-300'}
                      canDelete={isTopManager || interaction.user_id === user?.id}
                      onDelete={() => deleteInteractionMutation.mutate(interaction.id)}
                    />
                  );
                })}
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-black/40 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">
                  {isUk ? `Історія змін (${history.length})` : `Change history (${history.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.length === 0 && (
                  <p className="text-sm text-zinc-500">
                    {isUk ? 'Змін ще немає' : 'No changes yet'}
                  </p>
                )}
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-white">
                        {item.action === 'created'
                          ? isUk
                            ? 'Створено'
                            : 'Created'
                          : isUk
                            ? 'Оновлено'
                            : 'Updated'}
                      </span>
                      <span className="text-xs text-zinc-500">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {item.changed_by_name || (isUk ? 'Система' : 'System')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{isUk ? 'Редагувати нотатки клієнта' : 'Edit client notes'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                rows={6}
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                placeholder={
                  isUk
                    ? 'Додайте контекст по клієнту, пріоритети, домовленості...'
                    : 'Add client context, priorities, agreements...'
                }
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => saveNotesMutation.mutate()}
                  className="flex-1"
                  disabled={saveNotesMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isUk ? 'Зберегти' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  {isUk ? 'Скасувати' : 'Cancel'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
