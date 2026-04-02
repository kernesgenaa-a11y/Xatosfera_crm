import { useEffect, useState, useCallback } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Phone,
  Bed,
  Maximize2,
  Building2,
  Home,
  Thermometer,
  Bath,
  Wind,
  Layers,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  CalendarDays,
  DollarSign,
  Info,
  Eye,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PresentationPreviewModal } from '@/components/properties/PresentationPreviewModal';
import { PropertyPhotoViewer } from '@/components/properties/PropertyPhotoViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AuthImg } from '@/components/ui/AuthImg';
import { GoogleMap } from '@/components/ui/GoogleMap';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getApiUrl } from '@/lib/api-url';
import { type PresentationTemplate } from '@/lib/presentation-templates';
import {
  ChangeHistorySchema,
  PropertyDetailSchema,
  UserSchema,
  parseApiArray,
  parseApiObject,
} from '@/lib/schemas';
import type { ChangeHistory, PropertyDetail, User } from '@/types/api';

const API_URL = getApiUrl();

/* ── Label maps ─────────────────────────────────────────── */
const OP_LABELS: Record<string, string> = {
  sale: 'Продаж',
  rent: 'Оренда',
  new_build: 'Новобудова',
};
const CAT_LABELS: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Будинок',
  commercial: 'Комерція',
  other: 'Інше',
};
const COND_LABELS: Record<string, string> = {
  no_repair: 'Без ремонту',
  cosmetic: 'Косметичний',
  euro: 'Євроремонт',
  furnished: 'З меблями',
  after_build: 'Після забудовника',
};
const HEAT_LABELS: Record<string, string> = {
  central: 'Центральне',
  autonomous: 'Автономне',
  electric: 'Електричне',
  gas: 'Газове',
  none: 'Відсутнє',
};
const BATH_LABELS: Record<string, string> = {
  separate: 'Роздільний',
  combined: 'Суміщений',
};
const BAL_LABELS: Record<string, string> = {
  none: 'Немає',
  balcony: 'Балкон',
  loggia: 'Лоджія',
  balcony_loggia: 'Балкон + лоджія',
  terrace: 'Тераса',
};
const SRC_LABELS: Record<string, string> = {
  owner: 'Власник',
  database: 'База',
  partner: 'Партнер',
  other: 'Інше',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Активний',
  archived: 'Архів',
  sold: 'Продано',
  rented: 'Здано',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
  sold: 'bg-blue-100 text-blue-800 border-blue-200',
  rented: 'bg-violet-100 text-violet-800 border-violet-200',
};

type Manager = Pick<User, 'id' | 'full_name'>;

const parseArr = (v: string | string[] | null): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v) as string[];
  } catch {
    return [];
  }
};

/* ── Row helper ─────────────────────────────────────────── */
function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ElementType;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <span className="text-sm text-muted-foreground min-w-[140px] shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right flex-1">{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export const PropertyDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, user } = useAuth();
  const { language } = useLanguage();
  const isUk = language === 'uk';
  const isTopManager = role === 'top_manager' || role === 'superuser';

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [history, setHistory] = useState<ChangeHistory[]>([]);

  // Presentation preview modal
  const [presOpen, setPresOpen] = useState(false);
  const [presHtml, setPresHtml] = useState<string | null>(null);
  const [presLoading, setPresLoading] = useState(false);
  const [presDownloading, setPresDownloading] = useState(false);
  const [presentationTemplate, setPresentationTemplate] = useState<PresentationTemplate>('classic');
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  const loadPresentationPreview = useCallback(
    async (
      template: PresentationTemplate,
      title: string,
      price: string,
      desc: string,
      photos: string[],
    ) => {
      if (!property) return;
      setPresLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const params = new URLSearchParams({
          preview: '1',
          template,
          custom_title: title,
          custom_price: price,
          custom_desc: desc,
        });
        if (photos.length > 0) params.set('selected_photos', photos.join(','));
        const res = await fetch(
          `${API_URL}/api/properties/${property.id}/presentation?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) {
          setPresHtml(null);
          return;
        }
        setPresHtml(await res.text());
      } catch {
        setPresHtml(null);
      } finally {
        setPresLoading(false);
      }
    },
    [property],
  );

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('access_token');
    Promise.all([
      fetch(`${API_URL}/api/properties/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/properties/${id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(async ([pr, hr]) => {
        if (!pr.ok) {
          navigate('/properties');
          return;
        }
        const rawProperty = parseApiObject(
          PropertyDetailSchema,
          await pr.json(),
          'property detail',
        );
        if (!rawProperty) {
          navigate('/properties');
          return;
        }
        const p: PropertyDetail = {
          ...rawProperty,
          photos: parseArr(rawProperty.photos),
          owner_phones: parseArr(rawProperty.owner_phones),
          tags: parseArr(rawProperty.tags),
        };
        setProperty(p);
        // OPT: fetch only the single manager instead of all users
        if (p.manager_id) {
          fetch(`${API_URL}/api/users/${p.manager_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(async (r) =>
              r.ok ? parseApiObject(UserSchema, await r.json(), 'property manager') : null,
            )
            .then((mgr) => {
              if (mgr) {
                setManager({ id: mgr.id, full_name: mgr.full_name });
              }
            })
            .catch(() => {});
        }
        if (hr.ok) {
          setHistory(parseApiArray(ChangeHistorySchema, await hr.json(), 'property history'));
        }
      })
      .catch(() => navigate('/properties'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const canEdit = isTopManager || property?.manager_id === user?.id;

  const openPresentation = useCallback(async () => {
    if (!property) return;
    setPresOpen(true);
    setPresHtml(null);
    setPresentationTemplate('classic');
    const nextTitle = property.title ?? '';
    const nextPrice = property.price ? `${property.price} ${property.currency ?? 'UAH'}` : '';
    const nextDesc = property.description ?? '';
    const initPhotos = property.photos.slice(0, 6);
    setEditTitle(nextTitle);
    setEditPrice(nextPrice);
    setEditDesc(nextDesc);
    setSelectedPhotos(initPhotos);
    await loadPresentationPreview('classic', nextTitle, nextPrice, nextDesc, initPhotos);
  }, [property, loadPresentationPreview]);

  useEffect(() => {
    if (!property || !searchParams.get('presentation') || presOpen) return;
    void openPresentation();
  }, [property, searchParams, presOpen, openPresentation]);

  const closePresentation = useCallback(() => {
    setPresOpen(false);
    if (!searchParams.get('presentation')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('presentation');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const downloadPdf = useCallback(async () => {
    if (!property) return;
    setPresDownloading(true);
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({
        template: presentationTemplate,
        custom_title: editTitle,
        custom_price: editPrice,
        custom_desc: editDesc,
      });
      if (selectedPhotos.length > 0) params.set('selected_photos', selectedPhotos.join(','));
      const res = await fetch(
        `${API_URL}/api/properties/${property.id}/presentation?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${property.title ?? 'presentation'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* ignore */
    }
    setPresDownloading(false);
  }, [property, presentationTemplate, editTitle, editPrice, editDesc, selectedPhotos]);

  useEffect(() => {
    if (!presOpen || !property) return;
    const timeoutId = window.setTimeout(() => {
      void loadPresentationPreview(
        presentationTemplate,
        editTitle,
        editPrice,
        editDesc,
        selectedPhotos,
      );
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [
    presOpen,
    property,
    presentationTemplate,
    editTitle,
    editPrice,
    editDesc,
    selectedPhotos,
    loadPresentationPreview,
  ]);

  if (loading)
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );

  if (!property) return null;

  const photos = property.photos;
  const hasMaps = !!(property.latitude && property.longitude);

  const priceStr = property.price
    ? `${new Intl.NumberFormat('uk-UA').format(property.price)} ${property.currency ?? 'UAH'}`
    : '—';

  const addressFull = [
    property.city,
    property.street && `вул. ${property.street}`,
    property.building_number && `буд. ${property.building_number}`,
    property.block && `корп. ${property.block}`,
    property.district && `(${property.district})`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-10">
        {/* ── Nav row ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" className="px-0 gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            {isUk ? 'Назад' : 'Back'}
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void openPresentation()}>
              <Eye className="h-4 w-4 mr-2" />
              {isUk ? 'Презентація' : 'Presentation'}
            </Button>
            {canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/properties/${id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {isUk ? 'Редагувати' : 'Edit'}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ── Title + status ── */}
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl font-bold leading-tight flex-1">{property.title}</h1>
          <Badge
            className={`text-sm px-3 py-1 border ${STATUS_COLORS[property.status] ?? STATUS_COLORS.active}`}
          >
            {STATUS_LABELS[property.status] ?? property.status}
          </Badge>
        </div>

        {/* ── Address ── */}
        {addressFull && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <MapPin className="h-4 w-4 shrink-0" />
            {addressFull}
          </div>
        )}

        {/* ── MAIN GRID ── */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* LEFT col: photos + map */}
          <div className="lg:col-span-3 space-y-4">
            {/* Photos */}
            {photos.length > 0 ? (
              <div className="relative rounded-xl overflow-hidden bg-muted">
                <button
                  type="button"
                  onClick={() => setPhotoViewerOpen(true)}
                  className="w-full text-left group"
                  aria-label={isUk ? 'Відкрити перегляд фото' : 'Open photo viewer'}
                >
                  <AuthImg
                    fileKey={photos[photoIdx]}
                    alt={`${property.title} фото ${photoIdx + 1}`}
                    className="w-full h-72 object-cover"
                    fallback={
                      <div className="w-full h-72 bg-muted flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    }
                  />
                  <div className="absolute right-2 top-2 bg-black/55 text-white text-xs px-2 py-1 rounded-md opacity-90 group-hover:opacity-100 transition-opacity">
                    {isUk ? 'Переглянути' : 'View'}
                  </div>
                </button>
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      {photoIdx + 1} / {photos.length}
                    </div>
                  </>
                )}
                {/* Thumbnails */}
                {photos.length > 1 && (
                  <div className="flex gap-2 p-2 overflow-x-auto">
                    {photos.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={`shrink-0 rounded-md overflow-hidden border-2 transition-colors ${i === photoIdx ? 'border-primary' : 'border-transparent'}`}
                      >
                        <AuthImg
                          fileKey={url}
                          alt={`thumb-${i}`}
                          className="h-14 w-20 object-cover"
                          fallback={<div className="h-14 w-20 bg-muted" />}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-72 rounded-xl bg-muted flex flex-col items-center justify-center text-muted-foreground gap-2">
                <FileText className="h-10 w-10" />
                <span className="text-sm">{isUk ? 'Фото відсутні' : 'No photos'}</span>
              </div>
            )}

            {/* Map */}
            {hasMaps && (
              <div className="rounded-xl overflow-hidden border h-64">
                <GoogleMap lat={property.latitude!} lng={property.longitude!} zoom={16} />
              </div>
            )}

            {/* Description */}
            {property.description && (
              <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4 space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {isUk ? 'Опис' : 'Description'}
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {property.description}
                </p>
              </div>
            )}

            {/* Agent notes — only for managers */}
            {property.agent_notes && canEdit && (
              <div className="rounded-xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(86,63,14,0.22),rgba(20,16,10,0.86))] p-4 backdrop-blur-md space-y-2">
                <p className="text-sm font-semibold text-amber-200 uppercase tracking-wide flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {isUk ? 'Нотатки агента' : 'Agent Notes'}
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-200">
                  {property.agent_notes}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT col: info panels */}
          <div className="lg:col-span-2 space-y-4">
            {/* Price block */}
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {isUk ? 'Ціна' : 'Price'}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">{priceStr}</p>
              {property.negotiable === 1 && (
                <Badge variant="outline" className="mt-2 text-xs text-blue-600 border-blue-200">
                  {isUk ? 'Торг' : 'Negotiable'}
                </Badge>
              )}
              {property.additional_costs && (
                <p className="text-xs text-muted-foreground mt-2">
                  {isUk ? 'Додаткові витрати:' : 'Additional:'} {property.additional_costs}
                </p>
              )}
            </div>

            {/* Key characteristics */}
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {isUk ? 'Характеристики' : 'Characteristics'}
              </p>
              <div>
                <Row
                  label={isUk ? 'Тип операції' : 'Operation'}
                  value={OP_LABELS[property.operation_type ?? ''] ?? property.operation_type}
                  icon={Building2}
                />
                <Row
                  label={isUk ? 'Категорія' : 'Category'}
                  value={CAT_LABELS[property.category ?? ''] ?? property.category}
                  icon={Home}
                />
                <Row label={isUk ? 'Кімнат' : 'Rooms'} value={property.rooms} icon={Bed} />
                <Row
                  label={isUk ? 'Площа загальна' : 'Total area'}
                  value={property.area_total ? `${property.area_total} м²` : null}
                  icon={Maximize2}
                />
                <Row
                  label={isUk ? 'Площа житлова' : 'Living area'}
                  value={property.area_living ? `${property.area_living} м²` : null}
                  icon={Maximize2}
                />
                <Row
                  label={isUk ? 'Площа кухні' : 'Kitchen area'}
                  value={property.area_kitchen ? `${property.area_kitchen} м²` : null}
                  icon={Maximize2}
                />
                <Row
                  label="Сотки"
                  value={property.land_area_sotky ? `${property.land_area_sotky}` : null}
                  icon={Maximize2}
                />
                <Row
                  label={isUk ? 'Поверх' : 'Floor'}
                  value={
                    property.floors_total
                      ? `${property.floor ?? '—'} з ${property.floors_total}`
                      : property.floor
                  }
                  icon={Layers}
                />
                <Row
                  label={isUk ? 'Стан' : 'Condition'}
                  value={
                    COND_LABELS[property.property_condition ?? ''] ?? property.property_condition
                  }
                  icon={Home}
                />
                <Row
                  label={isUk ? 'Опалення' : 'Heating'}
                  value={HEAT_LABELS[property.heating ?? ''] ?? property.heating}
                  icon={Thermometer}
                />
                <Row
                  label={isUk ? 'Санвузол' : 'Bathroom'}
                  value={BATH_LABELS[property.bathroom ?? ''] ?? property.bathroom}
                  icon={Bath}
                />
                <Row
                  label={isUk ? 'Балкон' : 'Balcony'}
                  value={BAL_LABELS[property.balcony_type ?? ''] ?? property.balcony_type}
                  icon={Wind}
                />
              </div>
            </div>

            {/* Owner — only managers */}
            {canEdit && (property.owner_name || property.owner_phones?.length > 0) && (
              <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {isUk ? 'Власник' : 'Owner'}
                </p>
                {property.owner_name && <p className="font-semibold mb-2">{property.owner_name}</p>}
                {property.owner_phones?.map((ph, i) => (
                  <a
                    key={i}
                    href={`tel:${ph}`}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-1"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {ph}
                  </a>
                ))}
                {property.owner_notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {property.owner_notes}
                  </p>
                )}
              </div>
            )}

            {/* Meta */}
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {isUk ? 'Мета' : 'Meta'}
              </p>
              <Row label={isUk ? 'Агент' : 'Agent'} value={manager?.full_name} icon={User} />
              <Row
                label={isUk ? 'Джерело' : 'Source'}
                value={SRC_LABELS[property.source ?? ''] ?? property.source}
                icon={Info}
              />
              <Row
                label={isUk ? 'Створено' : 'Created'}
                value={new Date(
                  property.created_at + (property.created_at?.includes('Z') ? '' : 'Z'),
                ).toLocaleDateString('uk-UA')}
                icon={CalendarDays}
              />
              <Row
                label={isUk ? 'Оновлено' : 'Updated'}
                value={new Date(
                  property.updated_at + (property.updated_at?.includes('Z') ? '' : 'Z'),
                ).toLocaleDateString('uk-UA')}
                icon={CalendarDays}
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Історія змін
              </p>
              <div className="space-y-2">
                {history.length === 0 && (
                  <p className="text-xs text-muted-foreground">Змін ще немає</p>
                )}
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {item.action === 'created' ? 'Створено' : 'Оновлено'}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(
                          item.created_at + (item.created_at?.includes('Z') ? '' : 'Z'),
                        ).toLocaleString('uk-UA')}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {item.changed_by_name || 'Система'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PresentationPreviewModal
        isOpen={presOpen}
        isUk={isUk}
        presHtml={presHtml}
        presLoading={presLoading}
        presDownloading={presDownloading}
        presentationTemplate={presentationTemplate}
        editTitle={editTitle}
        editPrice={editPrice}
        editDesc={editDesc}
        photos={photos}
        selectedPhotos={selectedPhotos}
        onClose={closePresentation}
        onDownload={() => void downloadPdf()}
        setPresentationTemplate={setPresentationTemplate}
        setEditTitle={setEditTitle}
        setEditPrice={setEditPrice}
        setEditDesc={setEditDesc}
        setSelectedPhotos={setSelectedPhotos}
      />

      <PropertyPhotoViewer
        photos={photos}
        photoIdx={photoIdx}
        isOpen={photoViewerOpen}
        title={property.title}
        isUk={isUk}
        onClose={() => setPhotoViewerOpen(false)}
        setPhotoIdx={setPhotoIdx}
      />
    </AppLayout>
  );
};
