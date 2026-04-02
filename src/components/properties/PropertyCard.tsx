import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { getImageSources } from '@/lib/image-sources';

export type PropertyCardItem = {
  id: string;
  title: string;
  address: string;
  district: string | null;
  operation_type: string | null;
  category: string | null;
  status: string;
  price: number | null;
  currency: string | null;
  area_total: number | null;
  rooms: number | null;
  photos: string[];
  manager_id: string | null;
};

type Props = {
  property: PropertyCardItem;
  isTopManager: boolean;
  managerName?: string;
  presenting: boolean;
  photoIndex: number;
  onEdit?: () => void;
  onPresentation: () => void;
  onPhotoChange: (nextIndex: number, total: number) => void;
};

const statusColor: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  archived: 'bg-slate-100 text-slate-500 border border-slate-200',
  sold: 'bg-blue-100 text-blue-700 border border-blue-200',
  rented: 'bg-violet-100 text-violet-700 border border-violet-200',
};

const OP_LABELS: Record<string, string> = {
  sale: 'Продаж',
  rent: 'Оренда',
  new_build: 'Новобудова',
};
const CAT_LABELS: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Будинок',
  commercial: 'Комерція',
  land_plot: 'Ділянка',
  other: 'Інше',
};

export function PropertyCard({
  property,
  isTopManager,
  managerName,
  presenting,
  photoIndex,
  onPresentation,
  onPhotoChange,
}: Props) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const currentPhoto = property.photos[photoIndex];
  const imageSources = getImageSources(currentPhoto);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return t('properties.active');
      case 'archived':
        return t('properties.archived');
      case 'sold':
        return t('properties.sale') || 'Продано';
      case 'rented':
        return t('properties.rent') || 'Здано';
      default:
        return status;
    }
  };

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/properties/${property.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl">{property.title}</CardTitle>
          <Badge className={statusColor[property.status] ?? statusColor.active}>
            {getStatusLabel(property.status)}
          </Badge>
        </div>
        {isTopManager && managerName && (
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {managerName}
          </div>
        )}
        <div className="flex items-center gap-1 text-base text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {property.address}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {property.photos.length > 0 ? (
          <div className="relative">
            {imageSources.thumb ? (
              <img
                src={imageSources.thumb}
                srcSet={`${imageSources.thumb} 300w, ${imageSources.card} 600w, ${imageSources.detail} 1200w`}
                sizes="(max-width: 768px) 100vw, 300px"
                alt={`${property.title}-${photoIndex + 1}`}
                className="h-44 w-full rounded-md object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-44 w-full items-center justify-center rounded-md bg-muted">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            {property.photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPhotoChange(photoIndex - 1, property.photos.length);
                  }}
                  aria-label="Попереднє фото"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPhotoChange(photoIndex + 1, property.photos.length);
                  }}
                  aria-label="Наступне фото"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  {photoIndex + 1} / {property.photos.length}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ImageIcon className="mr-2 h-5 w-5" />
            {t('properties.noPhotos')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-base">
          <span className="text-muted-foreground">{t('properties.price_label')}</span>
          <strong>
            {property.price ? new Intl.NumberFormat('uk-UA').format(Number(property.price)) : '—'}{' '}
            {property.currency ?? t('common.uah')}
          </strong>

          <span className="text-muted-foreground">{t('properties.typeCategory')}</span>
          <strong>
            {OP_LABELS[property.operation_type ?? ''] ?? property.operation_type ?? '—'} /{' '}
            {CAT_LABELS[property.category ?? ''] ?? property.category ?? '—'}
          </strong>

          <span className="text-muted-foreground">{t('properties.roomsArea')}</span>
          <strong>
            {property.rooms ?? '—'} / {property.area_total ?? '—'} {t('properties.sqm')}
          </strong>

          <span className="text-muted-foreground">{t('properties.district_label')}</span>
          <strong>{property.district ?? '—'}</strong>
        </div>

        <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
          <Button variant="outline" asChild className="flex-1">
            <Link to={`/properties/${property.id}/edit`}>{t('properties.edit')}</Link>
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={presenting}
            onClick={onPresentation}
          >
            {presenting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === 'uk' ? 'Генерація...' : 'Generating...'}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {language === 'uk' ? 'Презентація' : 'Presentation'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
