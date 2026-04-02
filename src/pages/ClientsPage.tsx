import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ExternalLink,
  Pencil,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { cloudflareApi as pb } from '@/integrations/cloudflare/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClients, type ClientItem, type ClientManager } from '@/hooks/useClients';

const CURRENCIES = ['UAH', 'USD', 'EUR'];
const DISTRICTS = [
  'Центр',
  '101 мікрорайон',
  'Ковалівка',
  'Верхня Ковалівка',
  'Критий ринок',
  'Попова',
  'Жадова',
  'Соколівка',
  'Пацаєва',
  'Волкова',
  'Дендропарк',
  'Бєляєва',
  'Озерна Балка',
  'Балка',
  'Балашівка',
  'Стара Балашівка',
  'Типографія',
  'Яновського',
  'Олексіївка',
  'Міськсад',
  'Арнаутово',
  'Шкільний',
  'Пивзавод',
  'Масляниківка',
  'Гірничий',
  'Сонячне',
  'Старий автовокзал',
  'ЖД вокзал',
  'Велика Балка',
  '5/5',
  'Полтавська',
  'Миколаївка',
  'Некрасівка',
  'Лісопаркова',
  'Підгайці/Молодіжне',
  'Кущівка',
  'Катранівка',
  'Завадівка',
  'Селище Нове',
  'За містом',
  'м.Кропивницький',
  'с.Созонівка',
];

const EMPTY_FORM = {
  full_name: '',
  phone: '',
  segment: 'buyer',
  budget: '',
  currency: 'USD',
  notes: '',
  property_type: 'apartment',
  rooms_from: '1',
  rooms_to: '',
  district: '',
  land_area_sotky: '',
  manager_id: '',
};

const parseTags = (raw: string[] | string | null): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
};

const segmentDefaultCurrency = (segment: string) => (segment === 'tenant' ? 'UAH' : 'USD');

const segmentLabels: Record<string, string> = {
  buyer: 'Покупець',
  seller: 'Продавець',
  tenant: 'Орендар',
  landlord: 'Орендодавець',
};

const segmentColors: Record<string, string> = {
  buyer: 'bg-blue-100 text-blue-700 border-blue-200',
  seller: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  tenant: 'bg-amber-100 text-amber-700 border-amber-200',
  landlord: 'bg-violet-100 text-violet-700 border-violet-200',
};

const propertyLabels: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Будинок',
  commercial: 'Комерція',
  land_plot: 'Ділянка',
};

export const ClientsPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const isUk = language === 'uk';
  const isTopManager = role === 'top_manager' || role === 'superuser';
  const queryClient = useQueryClient();
  const clientsQuery = useClients(isTopManager, user?.id);
  const clients = clientsQuery.clients ?? [];
  const interactions = clientsQuery.interactions ?? {};
  const managers = clientsQuery.managers ?? [];

  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [newClient, setNewClient] = useState({ ...EMPTY_FORM });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);

  const refreshClients = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

  const createClientMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newClient.full_name.trim()) return;

      const { error } = await pb.from('clients').insert({
        full_name: newClient.full_name.trim(),
        phone: newClient.phone || null,
        segment: newClient.segment,
        budget: newClient.budget ? Number(newClient.budget) : null,
        currency: newClient.currency,
        notes: newClient.notes || null,
        property_type: newClient.property_type,
        rooms_from: newClient.rooms_from ? Number(newClient.rooms_from) : null,
        rooms_to: newClient.rooms_to ? Number(newClient.rooms_to) : null,
        district: newClient.district || null,
        land_area_sotky: newClient.land_area_sotky ? Number(newClient.land_area_sotky) : null,
        tags: JSON.stringify([]),
        created_by: user.id,
        manager_id: newClient.manager_id || user.id,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      setNewClient({ ...EMPTY_FORM });
      await refreshClients();
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;

      const payload: Record<string, unknown> = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone || null,
        segment: editForm.segment,
        budget: editForm.budget ? Number(editForm.budget) : null,
        currency: editForm.currency,
        notes: editForm.notes || null,
        property_type: editForm.property_type,
        rooms_from: editForm.rooms_from ? Number(editForm.rooms_from) : null,
        rooms_to: editForm.rooms_to ? Number(editForm.rooms_to) : null,
        district: editForm.district || null,
        land_area_sotky: editForm.land_area_sotky ? Number(editForm.land_area_sotky) : null,
      };

      if (isTopManager && editForm.manager_id) {
        payload.manager_id = editForm.manager_id;
      }

      const { error } = await pb.from('clients').update(payload).eq('id', editingId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditOpen(false);
      await refreshClients();
    },
  });

  const archiveClientMutation = useMutation({
    mutationFn: async (client: ClientItem) => {
      const nextStatus = (client.status ?? 'active') === 'archived' ? 'active' : 'archived';
      const { error } = await pb.from('clients').update({ status: nextStatus }).eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: refreshClients,
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await pb.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refreshClients,
  });

  const canEdit = (client: ClientItem) => {
    if (!user) return false;
    if (isTopManager) return true;
    return client.manager_id === user.id || client.created_by === user.id;
  };

  const createClient = async () => {
    await createClientMutation.mutateAsync();
  };

  const openEdit = (client: ClientItem) => {
    setEditingId(client.id);
    setEditForm({
      full_name: client.full_name,
      phone: client.phone ?? '',
      segment: client.segment,
      budget: client.budget?.toString() ?? '',
      currency: client.currency ?? segmentDefaultCurrency(client.segment),
      notes: client.notes ?? '',
      property_type: client.property_type ?? 'apartment',
      rooms_from: client.rooms_from?.toString() ?? '',
      rooms_to: client.rooms_to?.toString() ?? '',
      district: client.district ?? '',
      land_area_sotky: client.land_area_sotky?.toString() ?? '',
      manager_id: client.manager_id ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateClientMutation.mutateAsync();
  };

  const archiveClient = async (client: ClientItem) => {
    await archiveClientMutation.mutateAsync(client);
  };

  const deleteClient = async (id: string) => {
    await deleteClientMutation.mutateAsync(id);
  };

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch =
        !query ||
        client.full_name.toLowerCase().includes(query) ||
        (client.phone ?? '').toLowerCase().includes(query) ||
        (client.district ?? '').toLowerCase().includes(query);
      const matchesSegment = segment === 'all' || client.segment === segment;
      const matchesArchive = showArchived ? true : (client.status ?? 'active') !== 'archived';
      return matchesSearch && matchesSegment && matchesArchive;
    });
  }, [clients, search, segment, showArchived]);

  const managerName = (id: string | null) =>
    managers.find((manager) => manager.id === id)?.full_name ?? '—';

  const renderForm = (
    form: typeof EMPTY_FORM,
    setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>,
  ) => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          {isUk ? 'Категорія клієнта' : 'Segment'}
        </label>
        <Select
          value={form.segment}
          onValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              segment: value,
              currency:
                prev.currency === segmentDefaultCurrency(prev.segment)
                  ? segmentDefaultCurrency(value)
                  : prev.currency,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(segmentLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">{isUk ? "Повне ім'я" : 'Full name'}</label>
        <Input
          value={form.full_name}
          onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">{isUk ? 'Телефон' : 'Phone'}</label>
        <Input
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          {isUk ? 'Бюджет / Валюта' : 'Budget / Currency'}
        </label>
        <div className="flex gap-2">
          <Input
            type="number"
            value={form.budget}
            onChange={(e) => setForm((prev) => ({ ...prev, budget: e.target.value }))}
          />
          <Select
            value={form.currency}
            onValueChange={(value) => setForm((prev) => ({ ...prev, currency: value }))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          {isUk ? 'Тип нерухомості' : 'Property type'}
        </label>
        <Select
          value={form.property_type}
          onValueChange={(value) => setForm((prev) => ({ ...prev, property_type: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apartment">Квартира</SelectItem>
            <SelectItem value="house">Будинок</SelectItem>
            <SelectItem value="commercial">Комерція</SelectItem>
            <SelectItem value="land_plot">Ділянка</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          {isUk ? 'Кімнат від — до' : 'Rooms from — to'}
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            value={form.rooms_from}
            onChange={(e) => setForm((prev) => ({ ...prev, rooms_from: e.target.value }))}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min="1"
            value={form.rooms_to}
            onChange={(e) => setForm((prev) => ({ ...prev, rooms_to: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">{isUk ? 'Район' : 'District'}</label>
        <Select
          value={form.district || '__none__'}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, district: value === '__none__' ? '' : value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={isUk ? 'Будь-який' : 'Any'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{isUk ? 'Будь-який' : 'Any'}</SelectItem>
            {DISTRICTS.map((district) => (
              <SelectItem key={district} value={district}>
                {district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Сотки (для ділянок)</label>
        <Input
          type="number"
          step="0.1"
          value={form.land_area_sotky}
          onChange={(e) => setForm((prev) => ({ ...prev, land_area_sotky: e.target.value }))}
          disabled={form.property_type !== 'land_plot'}
        />
      </div>

      {isTopManager && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{isUk ? 'Агент' : 'Agent'}</label>
          <Select
            value={form.manager_id || user?.id || ''}
            onValueChange={(value) => setForm((prev) => ({ ...prev, manager_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={isUk ? 'Оберіть агента' : 'Select agent'} />
            </SelectTrigger>
            <SelectContent>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5 md:col-span-2 xl:col-span-4">
        <label className="text-xs text-muted-foreground">{isUk ? 'Нотатки' : 'Notes'}</label>
        <Textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{isUk ? 'Клієнти' : 'Clients'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isUk
                ? 'База покупців, продавців, орендарів і орендодавців'
                : 'Client base and activity overview'}
            </p>
          </div>
        </div>

        <Accordion type="single" collapsible defaultValue="filters">
          <AccordionItem value="filters" className="border-none">
            <Card className="overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline font-semibold">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  {isUk ? 'Фільтри та пошук' : 'Filters & Search'}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1.5 xl:col-span-2">
                    <label className="text-xs text-muted-foreground">
                      {isUk ? 'Пошук' : 'Search'}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={isUk ? 'Ім’я, телефон, район...' : 'Name, phone, district...'}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      {isUk ? 'Сегмент' : 'Segment'}
                    </label>
                    <Select value={segment} onValueChange={setSegment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {isUk ? 'Усі сегменти' : 'All segments'}
                        </SelectItem>
                        {Object.entries(segmentLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      {isUk ? 'Показати архів' : 'Show archive'}
                    </label>
                  </div>
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>

        <Card>
          <CardHeader>
            <CardTitle>{isUk ? 'Новий клієнт' : 'New client'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderForm(newClient, setNewClient)}
            <Button onClick={createClient} disabled={!newClient.full_name.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {isUk ? 'Додати клієнта' : 'Add client'}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map((client) => {
            const tags = parseTags(client.tags);
            const budgetSymbol =
              client.currency === 'USD' ? '$' : client.currency === 'EUR' ? '€' : '₴';
            return (
              <Card
                key={client.id}
                className="group cursor-pointer overflow-hidden border-white/10 bg-black/40 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="truncate text-lg font-semibold">{client.full_name}</h3>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        {(client.status ?? 'active') === 'archived' && (
                          <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {isUk ? 'Архів' : 'Archive'}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{client.phone || '—'}</span>
                      </div>
                    </div>

                    {canEdit(client) && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(client)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-amber-500 hover:text-amber-400"
                          onClick={() => void archiveClient(client)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {isUk ? 'Видалити клієнта?' : 'Delete client?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {isUk
                                  ? `Клієнта «${client.full_name}» буде видалено остаточно.`
                                  : `Client "${client.full_name}" will be removed permanently.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{isUk ? 'Скасувати' : 'Cancel'}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => void deleteClient(client.id)}
                              >
                                {isUk ? 'Видалити' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${segmentColors[client.segment] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}
                    >
                      {segmentLabels[client.segment] ?? client.segment}
                    </span>
                    <span className="text-muted-foreground">
                      {client.budget
                        ? `${client.budget.toLocaleString('uk-UA')} ${budgetSymbol}`
                        : '—'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-muted-foreground">
                      {isUk ? 'Тип / Кімнат' : 'Type / Rooms'}
                    </span>
                    <span className="font-medium text-right">
                      {propertyLabels[client.property_type ?? ''] ?? client.property_type ?? '—'} /{' '}
                      {client.rooms_from ?? '—'}
                      {client.rooms_to ? `–${client.rooms_to}` : ''}
                    </span>
                    <span className="text-muted-foreground">{isUk ? 'Район' : 'District'}</span>
                    <span className="font-medium text-right">{client.district || '—'}</span>
                    {client.property_type === 'land_plot' && (
                      <>
                        <span className="text-muted-foreground">Сотки</span>
                        <span className="font-medium text-right">
                          {client.land_area_sotky ?? '—'}
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">
                      {isUk ? 'Взаємодії' : 'Interactions'}
                    </span>
                    <span className="font-medium text-right">{interactions[client.id] ?? 0}</span>
                  </div>

                  {isTopManager && (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{isUk ? 'Агент:' : 'Agent:'}</span>
                      <span className="font-medium">{managerName(client.manager_id)}</span>
                    </div>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {client.notes && (
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground line-clamp-3">
                      {client.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {clientsQuery.hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => void clientsQuery.fetchNextPage()}
              disabled={clientsQuery.isFetchingNextPage}
            >
              {clientsQuery.isFetchingNextPage
                ? isUk
                  ? 'Завантаження...'
                  : 'Loading...'
                : isUk
                  ? 'Завантажити ще'
                  : 'Load more'}
            </Button>
          </div>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{isUk ? 'Редагувати клієнта' : 'Edit client'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {renderForm(editForm, setEditForm)}
              <div className="flex gap-2">
                <Button onClick={saveEdit} className="flex-1" disabled={!editForm.full_name.trim()}>
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
