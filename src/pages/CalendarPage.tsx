import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  setHours,
  setMinutes,
} from 'date-fns';
import { uk, enUS } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar,
  Clock,
  User,
  Building2,
  Tag,
  Trash2,
} from 'lucide-react';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCalendar } from '@/hooks/useCalendar';

interface EventItem {
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
interface Client {
  id: string;
  full_name: string;
}
interface Property {
  id: string;
  title: string;
  address: string;
}

const TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-blue-500',
  viewing: 'bg-violet-500',
  deadline: 'bg-rose-500',
  call: 'bg-amber-500',
  other: 'bg-slate-400',
};
const TYPE_LIGHT: Record<string, string> = {
  meeting: 'bg-blue-50 text-blue-700 border-blue-200',
  viewing: 'bg-violet-50 text-violet-700 border-violet-200',
  deadline: 'bg-rose-50 text-rose-700 border-rose-200',
  call: 'bg-amber-50 text-amber-700 border-amber-200',
  other: 'bg-slate-50 text-slate-600 border-slate-200',
};
const EVENT_TYPES_UK: Record<string, string> = {
  meeting: 'Зустріч',
  viewing: 'Перегляд',
  deadline: 'Дедлайн',
  call: 'Дзвінок',
  other: 'Інше',
};
const EVENT_TYPES_EN: Record<string, string> = {
  meeting: 'Meeting',
  viewing: 'Viewing',
  deadline: 'Deadline',
  call: 'Call',
  other: 'Other',
};
const WEEKDAYS_UK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getMonthGrid(date: Date): Date[] {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}
function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const CalendarPage = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const locale = language === 'uk' ? uk : enUS;
  const isUk = language === 'uk';

  const [view, setView] = useState<'month' | 'week'>('month');
  const [current, setCurrent] = useState(new Date());
  const queryClient = useQueryClient();
  const calendarQuery = useCalendar(Boolean(user));
  const events = calendarQuery.data?.events ?? [];
  const clients = calendarQuery.data?.clients ?? [];
  const properties = calendarQuery.data?.properties ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);

  const emptyForm = {
    title: '',
    description: '',
    date: '',
    time: '09:00',
    endTime: '10:00',
    event_type: 'meeting',
    client_id: '',
    property_id: '',
  };
  const [form, setForm] = useState(emptyForm);

  const refreshCalendar = () => queryClient.invalidateQueries({ queryKey: ['calendar'] });

  const saveEventMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editingEvent) {
        const { error } = await cloudflareApi
          .from('calendar-events')
          .update(payload)
          .eq('id', editingEvent.id);
        if (error) throw error;
        return;
      }

      const { error } = await cloudflareApi.from('calendar-events').insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setForm(emptyForm);
      await refreshCalendar();
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await cloudflareApi.from('calendar-events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDetailEvent(null);
      await refreshCalendar();
    },
  });

  const openNew = (date: Date) => {
    setEditingEvent(null);
    setForm({
      ...emptyForm,
      date: format(date, 'yyyy-MM-dd'),
      time: format(date, 'HH:mm'),
      endTime: format(new Date(date.getTime() + 3600000), 'HH:mm'),
    });
    setDialogOpen(true);
  };

  const openEdit = (e: EventItem) => {
    setDetailEvent(null);
    setEditingEvent(e);
    const d = parseISO(e.starts_at);
    setForm({
      title: e.title,
      description: e.description ?? '',
      date: format(d, 'yyyy-MM-dd'),
      time: format(d, 'HH:mm'),
      endTime: e.ends_at ? format(parseISO(e.ends_at), 'HH:mm') : format(d, 'HH:mm'),
      event_type: e.event_type,
      client_id: e.client_id ?? '',
      property_id: e.property_id ?? '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || !form.title || !form.date) return;
    const [h, m] = form.time.split(':').map(Number);
    const [eh, em] = form.endTime.split(':').map(Number);
    const starts = setMinutes(setHours(startOfDay(parseISO(form.date)), h), m).toISOString();
    const ends = setMinutes(setHours(startOfDay(parseISO(form.date)), eh), em).toISOString();
    const payload = {
      title: form.title,
      description: form.description || null,
      starts_at: starts,
      ends_at: ends,
      event_type: form.event_type,
      status: 'planned',
      property_id: form.property_id || null,
      client_id: form.client_id || null,
      user_id: user.id,
    };
    await saveEventMutation.mutateAsync(payload);
  };

  const remove = async (id: string) => {
    await deleteEventMutation.mutateAsync(id);
  };

  const eventsForDay = (d: Date) => events.filter((e) => isSameDay(parseISO(e.starts_at), d));
  const eventsForHour = (d: Date, h: number) =>
    events.filter((e) => {
      const s = parseISO(e.starts_at);
      return isSameDay(s, d) && s.getHours() === h;
    });
  const clientName = (id: string | null) =>
    id ? (clients.find((c) => c.id === id)?.full_name ?? '') : '';
  const propTitle = (id: string | null) =>
    id ? (properties.find((p) => p.id === id)?.title ?? '') : '';
  const typeLabel = (type: string) =>
    isUk ? (EVENT_TYPES_UK[type] ?? type) : (EVENT_TYPES_EN[type] ?? type);

  const monthDays = useMemo(() => getMonthGrid(current), [current]);
  const weekDays = useMemo(() => getWeekDays(current), [current]);
  const weekdays = isUk ? WEEKDAYS_UK : WEEKDAYS_EN;

  return (
    <AppLayout>
      <div className="flex flex-col space-y-4" style={{ minHeight: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">{isUk ? 'Календар' : 'Calendar'}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border overflow-hidden">
              {(['month', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${view === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                >
                  {v === 'month' ? (isUk ? 'Місяць' : 'Month') : isUk ? 'Тиждень' : 'Week'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  view === 'month'
                    ? setCurrent(subMonths(current, 1))
                    : setCurrent(subWeeks(current, 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrent(new Date())}>
                {isUk ? 'Сьогодні' : 'Today'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  view === 'month'
                    ? setCurrent(addMonths(current, 1))
                    : setCurrent(addWeeks(current, 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="font-semibold text-base min-w-[170px] text-center">
              {view === 'month'
                ? format(current, 'LLLL yyyy', { locale })
                : `${format(weekDays[0], 'd MMM', { locale })} – ${format(weekDays[6], 'd MMM yyyy', { locale })}`}
            </span>
            <Button onClick={() => openNew(new Date())} className="gap-1">
              <Plus className="h-4 w-4" />
              {isUk ? 'Подія' : 'Event'}
            </Button>
          </div>
        </div>

        {/* MONTH VIEW */}
        {view === 'month' && (
          <div className="border rounded-xl overflow-hidden bg-background">
            <div className="grid grid-cols-7 border-b bg-muted/30">
              {weekdays.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(100px, 1fr)' }}>
              {monthDays.map((day, idx) => {
                const dayEvs = eventsForDay(day);
                const inMonth = isSameMonth(day, current);
                const todayFlag = isToday(day);
                return (
                  <div
                    key={idx}
                    onClick={() => openNew(day)}
                    className={`border-b border-r p-1 cursor-pointer transition-colors hover:bg-accent/30 ${!inMonth ? 'opacity-35' : ''}`}
                  >
                    <div className="mb-1">
                      <span
                        className={`text-sm font-medium w-7 h-7 inline-flex items-center justify-center rounded-full ${todayFlag ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailEvent(ev);
                          }}
                          className={`text-[11px] px-1.5 py-0.5 rounded truncate border font-medium cursor-pointer hover:opacity-75 ${TYPE_LIGHT[ev.event_type] ?? TYPE_LIGHT.other}`}
                        >
                          {format(parseISO(ev.starts_at), 'HH:mm')} {ev.title}
                        </div>
                      ))}
                      {dayEvs.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          +{dayEvs.length - 3} {isUk ? 'ще' : 'more'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {view === 'week' && (
          <div className="border rounded-xl overflow-hidden bg-background">
            {/* Day headers */}
            <div
              className="grid border-b bg-muted/30"
              style={{ gridTemplateColumns: '56px repeat(7,1fr)' }}
            >
              <div className="border-r py-2" />
              {weekDays.map((d, i) => (
                <div
                  key={i}
                  className={`py-2 text-center border-r last:border-r-0 ${isToday(d) ? 'bg-primary/5' : ''}`}
                >
                  <div className="text-xs text-muted-foreground uppercase font-medium">
                    {weekdays[i]}
                  </div>
                  <div
                    className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isToday(d) ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {format(d, 'd')}
                  </div>
                </div>
              ))}
            </div>
            {/* Time grid */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid border-b"
                  style={{ gridTemplateColumns: '56px repeat(7,1fr)', minHeight: 48 }}
                >
                  <div className="border-r flex items-start justify-end pr-2 pt-1 text-[11px] text-muted-foreground font-medium select-none">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {weekDays.map((d, di) => {
                    const slotEvs = eventsForHour(d, hour);
                    return (
                      <div
                        key={di}
                        onClick={() => {
                          const dt = setMinutes(setHours(startOfDay(d), hour), 0);
                          openNew(dt);
                        }}
                        className={`border-r last:border-r-0 p-0.5 cursor-pointer hover:bg-accent/25 transition-colors ${isToday(d) ? 'bg-primary/[0.015]' : ''}`}
                      >
                        {slotEvs.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailEvent(ev);
                            }}
                            className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate border font-medium cursor-pointer hover:opacity-75 ${TYPE_LIGHT[ev.event_type] ?? TYPE_LIGHT.other}`}
                          >
                            <span className="font-bold">
                              {format(parseISO(ev.starts_at), 'HH:mm')}
                            </span>{' '}
                            {ev.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETAIL DIALOG */}
        <Dialog open={!!detailEvent} onOpenChange={(o) => !o && setDetailEvent(null)}>
          <DialogContent aria-describedby={undefined} className="max-w-sm">
            {detailEvent && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${TYPE_COLORS[detailEvent.event_type] ?? 'bg-slate-400'}`}
                    />
                    {detailEvent.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    {format(parseISO(detailEvent.starts_at), 'dd MMMM yyyy', { locale })}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    {format(parseISO(detailEvent.starts_at), 'HH:mm')}
                    {detailEvent.ends_at && ` – ${format(parseISO(detailEvent.ends_at), 'HH:mm')}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Badge className={`text-xs border ${TYPE_LIGHT[detailEvent.event_type]}`}>
                      {typeLabel(detailEvent.event_type)}
                    </Badge>
                  </div>
                  {detailEvent.client_id && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      {clientName(detailEvent.client_id)}
                    </div>
                  )}
                  {detailEvent.property_id && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4 shrink-0" />
                      {propTitle(detailEvent.property_id)}
                    </div>
                  )}
                  {detailEvent.description && (
                    <p className="text-muted-foreground border rounded p-2 bg-muted/30">
                      {detailEvent.description}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(detailEvent)}
                      className="flex-1"
                    >
                      {isUk ? 'Редагувати' : 'Edit'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(detailEvent.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* CREATE/EDIT DIALOG */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent aria-describedby={undefined} className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingEvent
                  ? isUk
                    ? 'Редагувати подію'
                    : 'Edit Event'
                  : isUk
                    ? 'Нова подія'
                    : 'New Event'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {isUk ? 'Назва *' : 'Title *'}
                </label>
                <Input
                  placeholder={isUk ? 'Назва події...' : 'Event title...'}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {isUk ? 'Тип події' : 'Event Type'}
                </label>
                <Select
                  value={form.event_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(isUk ? EVENT_TYPES_UK : EVENT_TYPES_EN).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${TYPE_COLORS[val]}`} />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isUk ? 'Дата *' : 'Date *'}
                  </label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isUk ? 'Початок' : 'Start'}
                  </label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isUk ? 'Кінець' : 'End'}
                  </label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {isUk ? "Клієнт (необов'язково)" : 'Client (optional)'}
                </label>
                <Select
                  value={form.client_id || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, client_id: v === '__none__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isUk ? 'Не вибрано' : 'None'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {isUk ? '— Без клієнта —' : '— None —'}
                    </SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {isUk ? "Об'єкт (необов'язково)" : 'Property (optional)'}
                </label>
                <Select
                  value={form.property_id || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, property_id: v === '__none__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isUk ? 'Не вибрано' : 'None'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {isUk ? "— Без об'єкту —" : '— None —'}
                    </SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {isUk ? 'Опис' : 'Description'}
                </label>
                <Textarea
                  rows={2}
                  placeholder={isUk ? 'Додатковий опис...' : 'Additional notes...'}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={save}
                  disabled={!form.title || !form.date}
                  className="flex-1 gradient-primary"
                >
                  {editingEvent ? (isUk ? 'Зберегти' : 'Save') : isUk ? 'Створити' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
