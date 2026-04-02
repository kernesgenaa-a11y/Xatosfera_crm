import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProperties } from '@/hooks/useProperties';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { PropertiesFilters } from '@/components/properties/PropertiesFilters';

const parseJsonArray = (raw: string | string[] | null | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
};

export const PropertiesPage = () => {
  const { t } = useLanguage();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isTopManager = role === 'top_manager' || role === 'superuser';

  const [presentingId, setPresentingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [operationType, setOperationType] = useState('all');
  const [category, setCategory] = useState('all');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [photoIndexes, setPhotoIndexes] = useState<Record<string, number>>({});

  const propertiesQuery = useProperties(isTopManager, user?.id);
  const properties = propertiesQuery.properties ?? [];
  const managers = propertiesQuery.managers ?? {};
  const loading = propertiesQuery.isLoading;

  const downloadPresentation = async (propertyId: string) => {
    setPresentingId(propertyId);
    navigate(`/properties/${propertyId}?presentation=1`);
    setPresentingId(null);
  };

  const filteredProperties = useMemo(
    () =>
      properties.filter((property) => {
        const query = search.toLowerCase().trim();
        const phones = parseJsonArray(property.owner_phones);

        const matchesSearch =
          !query ||
          property.id.toLowerCase().includes(query) ||
          property.title.toLowerCase().includes(query) ||
          (property.address ?? '').toLowerCase().includes(query) ||
          (property.district ?? '').toLowerCase().includes(query) ||
          phones.some((phone) => phone.includes(query));

        const matchesStatus = status === 'all' || property.status === status;
        const matchesArchive = showArchived || property.status !== 'archived';
        const matchesOperation =
          operationType === 'all' || property.operation_type === operationType;
        const matchesCategory = category === 'all' || property.category === category;
        const matchesPriceFrom = !priceFrom || Number(property.price ?? 0) >= Number(priceFrom);
        const matchesPriceTo = !priceTo || Number(property.price ?? 0) <= Number(priceTo);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesArchive &&
          matchesOperation &&
          matchesCategory &&
          matchesPriceFrom &&
          matchesPriceTo
        );
      }),
    [properties, search, status, showArchived, operationType, category, priceFrom, priceTo],
  );

  const setPhotoIndex = (propertyId: string, nextIndex: number, total: number) => {
    if (total <= 0) return;

    setPhotoIndexes((prev) => ({
      ...prev,
      [propertyId]: (nextIndex + total) % total,
    }));
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">{t('properties.title')}</h1>
          <Button asChild>
            <Link to="/properties/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('properties.add')}
            </Link>
          </Button>
        </div>

        <PropertiesFilters
          t={t}
          search={search}
          status={status}
          operationType={operationType}
          category={category}
          priceFrom={priceFrom}
          priceTo={priceTo}
          showArchived={showArchived}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onOperationTypeChange={setOperationType}
          onCategoryChange={setCategory}
          onPriceFromChange={setPriceFrom}
          onPriceToChange={setPriceTo}
          onShowArchivedChange={setShowArchived}
          onReset={() => {
            setStatus('all');
            setOperationType('all');
            setCategory('all');
            setPriceFrom('');
            setPriceTo('');
            setShowArchived(false);
          }}
        />

        {loading ? (
          <p>{t('common.loading')}</p>
        ) : filteredProperties.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-muted/20 py-20 text-center">
            <p className="text-muted-foreground">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProperties.map((property) => {
                const photos = parseJsonArray(property.photos);
                const currentPhotoIndex =
                  photos.length > 0 ? (photoIndexes[property.id] ?? 0) % photos.length : 0;

                return (
                  <PropertyCard
                    key={property.id}
                    property={{
                      id: property.id,
                      title: property.title,
                      address: property.address ?? '',
                      district: property.district ?? null,
                      operation_type: property.operation_type ?? null,
                      category: property.category ?? null,
                      status: property.status,
                      price: property.price ?? null,
                      currency: property.currency ?? null,
                      area_total: property.area_total ?? null,
                      rooms: property.rooms ?? null,
                      photos,
                      manager_id: property.manager_id ?? null,
                    }}
                    isTopManager={isTopManager}
                    managerName={property.manager_id ? managers[property.manager_id] : undefined}
                    presenting={presentingId === property.id}
                    photoIndex={currentPhotoIndex}
                    onPresentation={() => void downloadPresentation(property.id)}
                    onPhotoChange={(nextIndex, total) =>
                      setPhotoIndex(property.id, nextIndex, total)
                    }
                  />
                );
              })}
            </div>

            {propertiesQuery.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void propertiesQuery.fetchNextPage()}
                  disabled={propertiesQuery.isFetchingNextPage}
                >
                  {propertiesQuery.isFetchingNextPage ? t('common.loading') : 'Завантажити ще'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};
