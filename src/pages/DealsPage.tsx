import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
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
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  DollarSign,
  Eye,
  FileText,
  Handshake,
  Loader2,
  Pencil,
  Plus,
  Search,
  TrendingUp,
  Trash2,
  User,
} from 'lucide-react';
import { useDeals } from '@/hooks/useDeals';

const STAGES = ['lead', 'viewing', 'offer', 'deal', 'closed'] as const;
type Stage = (typeof STAGES)[number];

const STAGE_CONFIG: Record<
  Stage,
  {
    label: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    border: string;
    dot: string;
  }
> = {
  lead: {
    label: 'Лід',
    labelEn: 'Lead',
    icon: TrendingUp,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  viewing: {
    label: 'Перегляд',
    labelEn: 'Viewing',
    icon: Eye,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  offer: {
    label: 'Пропозиція',
    labelEn: 'Offer',
    icon: FileText,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  deal: {
    label: 'Угода',
    labelEn: 'Deal',
    icon: Handshake,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  closed: {
    label: 'Завершено',
    labelEn: 'Closed',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
};

type Deal = {
  id: string;
  title: string;
  stage: Stage;
  amount: number | null;
  currency: string | null;
  notes: string | null;
};

type Property = { id: string; title: string; address: string };
type Client = { id: string; full_name: string };

const CURR_SYM: Record<string, string> = { USD: '$', EUR: '€', UAH: '₴' };

export const DealsPage = () => {
  const { language } = useLanguage();
  const { role, user } = useAuth();
  const isUk = language === 'uk';
  const [moving, setMoving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceModal, setPriceModal] = useState<{ deal: Deal; nextStage: Stage } | null>(null);
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [dealNotes, setDealNotes] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const queryClient = useQueryClient();
  const dealsQuery = useDeals(role, user?.id);
  const deals = (dealsQuery.deals ?? []) as Deal[];
  const properties = (dealsQuery.properties ?? []) as Property[];
  const clients = (dealsQuery.clients ?? []) as Client[];
  const loading = dealsQuery.isLoading;
  const invalidateDeals = () => queryClient.invalidateQueries({ queryKey: ['deals'] });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await cloudflareApi.from('deals').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateDeals,
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await cloudflareApi.from('deals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidateDeals,
  });

  const createDealMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await cloudflareApi.from('deals').insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidateDeals,
  });

  const stats = useMemo(() => {
    const byStage = Object.fromEntries(STAGES.map((stage) => [stage, 0])) as Record<Stage, number>;
    deals.forEach((deal) => {
      byStage[deal.stage] = (byStage[deal.stage] ?? 0) + 1;
    });
    const revenue = deals
      .filter((deal) => deal.stage === 'deal' || deal.stage === 'closed')
      .reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
    return { ...byStage, revenue };
  }, [deals]);

  const moveDeal = async (deal: Deal) => {
    const idx = STAGES.indexOf(deal.stage);
    if (idx < 0 || idx === STAGES.length - 1) return;
    const nextStage = STAGES[idx + 1];
    if (nextStage === 'deal') {
      setPriceAmount(deal.amount ? String(deal.amount) : '');
      setPriceCurrency(deal.currency ?? 'USD');
      setDealNotes(deal.notes ?? '');
      setPriceModal({ deal, nextStage });
      return;
    }
    setMoving(deal.id);
    await updateDealMutation.mutateAsync({ id: deal.id, payload: { stage: nextStage } });
    setMoving(null);
  };

  const savePriceAndMove = async () => {
    if (!priceModal) return;
    if (!priceAmount || Number(priceAmount) <= 0) {
      toast.error(isUk ? 'Введіть суму угоди' : 'Enter deal amount');
      return;
    }
    setSavingPrice(true);
    const isEdit = priceModal.nextStage === priceModal.deal.stage;
    const payload: Record<string, unknown> = {
      amount: Number(priceAmount),
      currency: priceCurrency,
      notes: dealNotes || null,
    };
    if (!isEdit) payload.stage = priceModal.nextStage;
    await updateDealMutation.mutateAsync({ id: priceModal.deal.id, payload });
    setSavingPrice(false);
    setPriceModal(null);
    toast.success(
      isEdit
        ? isUk
          ? 'Вартість оновлено'
          : 'Amount updated'
        : isUk
          ? 'Вартість збережено, угода підтверджена'
          : 'Amount saved, deal confirmed',
    );
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!selectedPropertyId && !selectedClientId) {
      toast.error(isUk ? "Виберіть об'єкт або клієнта" : 'Select a property or client');
      return;
    }
    const property = properties.find((item) => item.id === selectedPropertyId);
    const client = clients.find((item) => item.id === selectedClientId);
    const title = property ? `Угода: ${property.title}` : `Угода: ${client?.full_name}`;
    await createDealMutation.mutateAsync({
      title,
      stage: 'lead',
      property_id: selectedPropertyId || null,
      client_id: selectedClientId || null,
      created_by: user.id,
      assigned_agent_id: role === 'manager' ? user.id : null,
    });
    toast.success(isUk ? 'Угоду створено' : 'Deal created');
    setDialogOpen(false);
    setSelectedPropertyId('');
    setSelectedClientId('');
    setSearchQuery('');
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(deleteId);
    await deleteDealMutation.mutateAsync(deleteId);
    setDeleteId(null);
    setDeleting(null);
    toast.success(isUk ? 'Угоду видалено' : 'Deal deleted');
  };

  const filteredProps = useMemo(
    () =>
      searchQuery
        ? properties.filter(
            (property) =>
              property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (property.address ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : properties,
    [properties, searchQuery],
  );
  const filteredClients = useMemo(
    () =>
      searchQuery
        ? clients.filter((client) =>
            client.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : clients,
    [clients, searchQuery],
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(242,190,82,0.18),transparent_35%),linear-gradient(180deg,rgba(18,18,18,0.94),rgba(8,8,8,0.94))] p-6 shadow-2xl sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Briefcase className="h-6 w-6 text-amber-300" />
              {isUk ? 'Угоди' : 'Deals'}
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              {isUk ? 'Відстежуйте угоди по стадіях' : 'Track deals through pipeline stages'}
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="shrink-0 gap-2 bg-amber-400 text-black hover:bg-amber-300"
          >
            <Plus className="h-4 w-4" />
            {isUk ? 'Нова угода' : 'New Deal'}
          </Button>
        </div>

        {!loading && deals.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              {STAGES.map((stage) => {
                const cfg = STAGE_CONFIG[stage];
                const Icon = cfg.icon;
                return (
                  <div
                    key={stage}
                    className="rounded-xl border border-white/10 bg-black/40 p-3 text-center backdrop-blur-md"
                  >
                    <Icon className={`mx-auto mb-1 h-4 w-4 ${cfg.color}`} />
                    <div className={`text-xl font-bold ${cfg.color}`}>{stats[stage]}</div>
                    <div className={`mt-0.5 text-[10px] font-medium opacity-80 ${cfg.color}`}>
                      {isUk ? cfg.label : cfg.labelEn}
                    </div>
                  </div>
                );
              })}
            </div>
            {stats.revenue > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur-md">
                <DollarSign className="h-4 w-4 shrink-0 text-purple-500" />
                <div>
                  <p className="text-[10px] font-medium text-purple-500">
                    {isUk ? 'Сума угод' : 'Deals volume'}
                  </p>
                  <p className="text-sm font-bold text-purple-700">
                    {stats.revenue.toLocaleString('uk-UA')}{' '}
                    <span className="text-xs font-normal">USD</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : deals.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-muted/20 py-20 text-center">
            <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">
              {isUk ? 'Угод ще немає' : 'No deals yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isUk
                ? 'Створіть першу угоду натиснувши "+ Нова угода"'
                : 'Create your first deal above'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {STAGES.map((stage) => {
              const cfg = STAGE_CONFIG[stage];
              const Icon = cfg.icon;
              const cards = deals.filter((deal) => deal.stage === stage);
              const isLast = stage === 'closed';
              return (
                <div
                  key={stage}
                  className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md"
                >
                  <div
                    className={`flex items-center gap-2 border-b border-white/10 px-3 py-3 ${cfg.bg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                    <span className={`text-sm font-semibold ${cfg.color}`}>
                      {isUk ? cfg.label : cfg.labelEn}
                    </span>
                    {cards.length > 0 && (
                      <span
                        className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-black/40 text-xs font-bold ${cfg.color}`}
                      >
                        {cards.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    {cards.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center py-6">
                        <p className="text-center text-xs text-muted-foreground/50">
                          {isUk ? 'Порожньо' : 'Empty'}
                        </p>
                      </div>
                    ) : (
                      cards.map((deal) => (
                        <div
                          key={deal.id}
                          className="group space-y-2.5 rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,26,0.94),rgba(12,12,14,0.98))] p-3.5 shadow-lg shadow-black/20 transition-all hover:border-amber-300/25 hover:bg-[linear-gradient(180deg,rgba(28,28,30,0.98),rgba(16,16,18,1))]"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p
                              className="min-w-0 flex-1 truncate text-sm font-medium leading-snug"
                              title={deal.title}
                            >
                              {deal.title}
                            </p>
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              {(deal.stage === 'deal' || deal.stage === 'closed') && (
                                <button
                                  onClick={() => {
                                    setPriceAmount(deal.amount ? String(deal.amount) : '');
                                    setPriceCurrency(deal.currency ?? 'USD');
                                    setDealNotes(deal.notes ?? '');
                                    setPriceModal({ deal, nextStage: deal.stage });
                                  }}
                                  className="rounded p-0.5 text-muted-foreground hover:text-purple-600"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteId(deal.id)}
                                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {(deal.stage === 'deal' || deal.stage === 'closed') && (
                            <div
                              className="cursor-pointer rounded-md border border-purple-300/20 bg-purple-500/10 px-2.5 py-1.5 transition-colors hover:border-purple-300/40"
                              onClick={() => {
                                setPriceAmount(deal.amount ? String(deal.amount) : '');
                                setPriceCurrency(deal.currency ?? 'USD');
                                setDealNotes(deal.notes ?? '');
                                setPriceModal({ deal, nextStage: deal.stage });
                              }}
                            >
                              {deal.amount ? (
                                <p className="text-xs font-bold text-purple-200">
                                  {CURR_SYM[deal.currency ?? 'USD'] ?? '$'}
                                  {deal.amount.toLocaleString('uk-UA')}
                                  {deal.currency && deal.currency !== 'USD' && (
                                    <span className="ml-1 font-normal text-purple-300/70">
                                      {deal.currency}
                                    </span>
                                  )}
                                </p>
                              ) : (
                                <p className="flex items-center gap-1 text-[11px] text-purple-300/80">
                                  <DollarSign className="h-3 w-3" />
                                  Вкажіть вартість
                                </p>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color} ${cfg.border}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </div>
                          {isLast ? (
                            <div
                              className={`w-full rounded-md py-1 text-center text-xs font-medium ${cfg.bg} ${cfg.color}`}
                            >
                              ✓ Завершено
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="group/btn h-8 w-full gap-1 border-white/10 bg-white/[0.03] text-xs text-white hover:bg-white/[0.08]"
                              disabled={moving === deal.id}
                              onClick={() => void moveDeal(deal)}
                            >
                              {moving === deal.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
                                  {isUk
                                    ? STAGES[STAGES.indexOf(deal.stage) + 1]
                                      ? STAGE_CONFIG[STAGES[STAGES.indexOf(deal.stage) + 1]].label
                                      : ''
                                    : STAGES[STAGES.indexOf(deal.stage) + 1]
                                      ? STAGE_CONFIG[STAGES[STAGES.indexOf(deal.stage) + 1]].labelEn
                                      : ''}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dealsQuery.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void dealsQuery.fetchNextPage()}
            disabled={dealsQuery.isFetchingNextPage}
          >
            {dealsQuery.isFetchingNextPage
              ? isUk
                ? 'Завантаження...'
                : 'Loading...'
              : isUk
                ? 'Завантажити ще'
                : 'Load more'}
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {isUk ? 'Нова угода' : 'New Deal'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                placeholder={isUk ? "Пошук об'єкта або клієнта..." : 'Search property or client...'}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {isUk ? "Об'єкт нерухомості" : 'Property'}
              </Label>
              <Select
                value={selectedPropertyId}
                onValueChange={(value) => {
                  setSelectedPropertyId(value);
                  if (value) setSelectedClientId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isUk ? 'Не вибрано...' : 'Not selected...'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredProps.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-xs uppercase text-muted-foreground">
                  {isUk ? 'або' : 'or'}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {isUk ? 'Клієнт' : 'Client'}
              </Label>
              <Select
                value={selectedClientId}
                onValueChange={(value) => {
                  setSelectedClientId(value);
                  if (value) setSelectedPropertyId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isUk ? 'Не вибрано...' : 'Not selected...'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => void handleCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              {isUk ? 'Створити угоду' : 'Create Deal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!priceModal} onOpenChange={(open) => !open && setPriceModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-500" />
              {priceModal?.nextStage === priceModal?.deal.stage
                ? isUk
                  ? 'Редагувати вартість'
                  : 'Edit amount'
                : isUk
                  ? 'Підтвердження угоди'
                  : 'Deal confirmation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5">
              <p className="text-xs font-medium text-purple-600">{priceModal?.deal.title}</p>
              {priceModal?.nextStage !== priceModal?.deal.stage && (
                <p className="mt-0.5 text-[11px] text-purple-400">
                  {isUk
                    ? 'Вкажіть фінальну вартість перед підтвердженням угоди'
                    : 'Enter final price before confirming deal'}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isUk ? 'Сума угоди *' : 'Deal amount *'}
              </Label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  value={priceAmount}
                  onChange={(event) => setPriceAmount(event.target.value)}
                  className="h-10 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">$ USD</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                    <SelectItem value="UAH">₴ UAH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isUk ? 'Нотатка до угоди' : 'Deal note'}
              </Label>
              <Textarea
                placeholder={isUk ? 'Додаткові умови, деталі...' : 'Additional terms, details...'}
                value={dealNotes}
                onChange={(event) => setDealNotes(event.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPriceModal(null)}>
                {isUk ? 'Скасувати' : 'Cancel'}
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                onClick={() => void savePriceAndMove()}
                disabled={savingPrice}
              >
                {savingPrice ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="mr-2 h-4 w-4" />
                )}
                {priceModal?.nextStage !== priceModal?.deal.stage
                  ? isUk
                    ? 'Підтвердити угоду'
                    : 'Confirm deal'
                  : isUk
                    ? 'Зберегти'
                    : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isUk ? 'Видалити угоду?' : 'Delete deal?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isUk ? 'Цю дію неможливо скасувати.' : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isUk ? 'Скасувати' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
              disabled={!!deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isUk ? (
                'Видалити'
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};
