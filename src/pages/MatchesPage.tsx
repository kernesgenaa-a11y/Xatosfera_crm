import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  EyeOff,
  FileText,
  Home,
  Layers,
  Loader2,
  RotateCcw,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMatches } from '@/hooks/useMatches';
import { getApiUrl } from '@/lib/api-url';
import type { MatchItem } from '@/types/api';

const API_URL = getApiUrl();

const CATEGORY_LABELS: Record<string, { uk: string; en: string }> = {
  apartment: { uk: 'Квартира', en: 'Apartment' },
  house: { uk: 'Будинок', en: 'House' },
  commercial: { uk: 'Комерція', en: 'Commercial' },
  land_plot: { uk: 'Ділянка', en: 'Land plot' },
  other: { uk: 'Інше', en: 'Other' },
};

const OPERATION_LABELS: Record<string, { uk: string; en: string }> = {
  sale: { uk: 'Продаж', en: 'Sale' },
  rent: { uk: 'Оренда', en: 'Rent' },
  new_build: { uk: 'Новобудова', en: 'New build' },
};

const SEGMENT_LABELS: Record<string, { uk: string; en: string }> = {
  buyer: { uk: 'Покупець', en: 'Buyer' },
  seller: { uk: 'Продавець', en: 'Seller' },
  tenant: { uk: 'Орендар', en: 'Tenant' },
  landlord: { uk: 'Орендодавець', en: 'Landlord' },
};

const formatPrice = (price: number, currency: string) => {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? 'EUR' : 'грн';
  return `${price.toLocaleString('uk-UA')} ${symbol}`;
};

const formatSotky = (value: number | null | undefined) => {
  if (value == null) return '—';
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
};

const getScoreColor = (score: number) => {
  if (score >= 95) {
    return { border: '#22c55e', bg: 'rgba(34,197,94,0.08)', badge: 'bg-green-100 text-green-800' };
  }

  if (score >= 80) {
    return { border: '#84cc16', bg: 'rgba(132,204,22,0.08)', badge: 'bg-lime-100 text-lime-800' };
  }

  return { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', badge: 'bg-amber-100 text-amber-800' };
};

const labelFor = (map: Record<string, { uk: string; en: string }>, value: string, isUk: boolean) =>
  map[value]?.[isUk ? 'uk' : 'en'] ?? value;

const formatReasons = (reasons: string[], isUk: boolean) =>
  reasons.length > 0
    ? reasons
    : [isUk ? 'Автоматичний збіг за критеріями' : 'Automatic criteria match'];

export const MatchesPage = () => {
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const isUk = language === 'uk';
  const isTopManager = role === 'top_manager' || role === 'superuser';
  const queryClient = useQueryClient();
  const matchesQuery = useMatches(Boolean(user));
  const matches = matchesQuery.data ?? [];

  const dismissMutation = useMutation({
    mutationFn: async (match: MatchItem) => {
      const token = localStorage.getItem('access_token');
      const endpoint = match.is_dismissed ? '/api/matches/restore' : '/api/matches/dismiss';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ property_id: match.propertyId, client_id: match.clientId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update match visibility');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  const openPresentation = (propertyId: string) => {
    window.location.assign(`/properties/${propertyId}?presentation=1`);
  };

  const activeCount = matches.filter((match) => !match.is_dismissed).length;
  const dismissedCount = matches.filter((match) => match.is_dismissed).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Layers className="h-6 w-6 text-primary" />
              {isUk ? 'Метчі' : 'Matches'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isUk
                ? 'Підбір за типом нерухомості, бюджетом і ключовими параметрами. Для ділянок окремо враховується збіг соток у межах ±15%.'
                : 'Matching by property type, budget, and key parameters. Land plots also use a separate land-area match within ±15%.'}
            </p>
          </div>

          {!matchesQuery.isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              {activeCount} {isUk ? 'активних' : 'active'}
              {dismissedCount > 0 && (
                <span className="ml-1 text-muted-foreground/60">
                  · {dismissedCount} {isUk ? 'прихованих' : 'hidden'}
                </span>
              )}
            </div>
          )}
        </div>

        {!isTopManager && !matchesQuery.isLoading && matches.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">
              <Building2 className="h-3 w-3" />
              {isUk ? "Мій об'єкт" : 'My property'}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-700">
              <User className="h-3 w-3" />
              {isUk ? 'Мій клієнт' : 'My client'}
            </span>
          </div>
        )}

        {matchesQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : matchesQuery.isError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
            <p className="font-medium text-destructive">
              {isUk ? 'Не вдалося завантажити метчі' : 'Failed to load matches'}
            </p>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-muted/20 py-20 text-center">
            <Home className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">
              {isUk ? 'Наразі співпадінь не знайдено' : 'No matches found yet'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isUk
                ? 'Додайте клієнтів і об’єкти з бюджетом, типом та параметрами пошуку.'
                : 'Add clients and properties with budget, type, and search parameters.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {matches.map((match) => {
              const { border, bg, badge } = getScoreColor(match.score);
              const isBusy =
                dismissMutation.isPending && dismissMutation.variables?.id === match.id;
              const isDismissed = match.is_dismissed;
              const isLandPlot = match.property.category === 'land_plot';

              return (
                <div
                  key={match.id}
                  className={`overflow-hidden rounded-xl border transition-all hover:shadow-md ${
                    isDismissed ? 'opacity-55 grayscale' : ''
                  }`}
                  style={{
                    borderColor: isDismissed ? '#94a3b8' : border,
                    background: isDismissed ? 'rgba(148,163,184,0.06)' : bg,
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-md"
                    style={{
                      borderColor: isDismissed ? '#94a3b8' : border,
                      background: isDismissed ? 'rgba(148,163,184,0.10)' : `${border}15`,
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${isDismissed ? 'bg-slate-100 text-slate-500' : badge}`}
                      >
                        {match.score}% {isUk ? 'збіг' : 'match'}
                      </span>
                      {formatReasons(match.reasons, isUk).map((reason) => (
                        <span
                          key={`${match.id}-${reason}`}
                          className="rounded-full border bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissMutation.mutate(match)}
                      disabled={isBusy}
                      className={`shrink-0 rounded-lg p-1.5 transition-colors ${
                        isDismissed
                          ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                          : 'text-muted-foreground hover:bg-slate-100 hover:text-slate-600'
                      }`}
                      title={
                        isDismissed
                          ? isUk
                            ? 'Відновити метч'
                            : 'Restore match'
                          : isUk
                            ? 'Приховати метч'
                            : 'Hide match'
                      }
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isDismissed ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="grid divide-y divide-border/50 backdrop-blur-md md:grid-cols-2 md:divide-x md:divide-y-0">
                    <div
                      className={`space-y-3 p-4 ${match.myProperty && !isTopManager ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`rounded-md p-1.5 ${match.myProperty && !isTopManager ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}
                          >
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {isUk ? "Об'єкт" : 'Property'}
                              {!isTopManager && match.myProperty && (
                                <span className="ml-1.5 text-blue-600">
                                  {isUk ? '· мій' : '· mine'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-semibold leading-tight">
                              {match.property.title}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {labelFor(OPERATION_LABELS, match.property.operation_type, isUk)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="text-muted-foreground">{isUk ? 'Ціна' : 'Price'}</div>
                        <div className="font-semibold">
                          {formatPrice(match.property.price, match.property.currency)}
                        </div>

                        <div className="text-muted-foreground">{isUk ? 'Тип' : 'Type'}</div>
                        <div className="font-medium">
                          {labelFor(CATEGORY_LABELS, match.property.category, isUk)}
                        </div>

                        {!isLandPlot && (
                          <>
                            <div className="text-muted-foreground">{isUk ? 'Кімнат' : 'Rooms'}</div>
                            <div className="font-medium">{match.property.rooms}</div>
                          </>
                        )}

                        {match.property.area_total != null && (
                          <>
                            <div className="text-muted-foreground">{isUk ? 'Площа' : 'Area'}</div>
                            <div className="font-medium">
                              {match.property.area_total} {isUk ? 'м²' : 'm²'}
                            </div>
                          </>
                        )}

                        {isLandPlot && (
                          <>
                            <div className="text-muted-foreground">
                              {isUk ? 'Сотки' : 'Land area'}
                            </div>
                            <div className="font-medium">
                              {formatSotky(match.property.land_area_sotky)}
                            </div>
                          </>
                        )}

                        {(match.property.street || match.property.district) && (
                          <>
                            <div className="text-muted-foreground">
                              {isUk ? 'Адреса' : 'Address'}
                            </div>
                            <div className="truncate font-medium">
                              {match.property.street || match.property.district}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-0.5 text-xs">
                        <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{isUk ? 'Агент:' : 'Agent:'}</span>
                        <span className="font-medium text-blue-700">{match.property.manager}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-8 w-full gap-1.5 text-xs"
                        onClick={() => openPresentation(match.propertyId)}
                      >
                        <FileText className="h-3 w-3" />
                        {isUk ? 'Презентація' : 'Presentation'}
                      </Button>
                    </div>

                    <div
                      className={`space-y-3 p-4 ${match.myClient && !isTopManager ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`rounded-md p-1.5 ${match.myClient && !isTopManager ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}
                          >
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {isUk ? 'Клієнт' : 'Client'}
                              {!isTopManager && match.myClient && (
                                <span className="ml-1.5 text-orange-600">
                                  {isUk ? '· мій' : '· mine'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-semibold leading-tight">
                              {match.client.name}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 rounded bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                          {labelFor(SEGMENT_LABELS, match.client.segment, isUk)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="text-muted-foreground">{isUk ? 'Бюджет' : 'Budget'}</div>
                        <div className="font-semibold">
                          {formatPrice(match.client.budget, match.client.currency)}
                        </div>

                        <div className="text-muted-foreground">{isUk ? 'Тип' : 'Type'}</div>
                        <div className="font-medium">
                          {labelFor(CATEGORY_LABELS, match.client.property_type, isUk)}
                        </div>

                        {match.client.property_type !== 'land_plot' && (
                          <>
                            <div className="text-muted-foreground">{isUk ? 'Кімнат' : 'Rooms'}</div>
                            <div className="font-medium">{match.client.rooms_needed}</div>
                          </>
                        )}

                        {match.client.property_type === 'land_plot' && (
                          <>
                            <div className="text-muted-foreground">
                              {isUk ? 'Сотки' : 'Land area'}
                            </div>
                            <div className="font-medium">
                              {formatSotky(match.client.land_area_sotky)}
                            </div>
                          </>
                        )}

                        {match.client.phone && (
                          <>
                            <div className="text-muted-foreground">
                              {isUk ? 'Телефон' : 'Phone'}
                            </div>
                            <div className="font-medium">{match.client.phone}</div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-0.5 text-xs">
                        <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{isUk ? 'Агент:' : 'Agent:'}</span>
                        <span className="font-medium text-orange-700">{match.client.manager}</span>
                      </div>

                      <div className="h-8" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};
