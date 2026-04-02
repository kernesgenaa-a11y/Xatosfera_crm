import { Search } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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

type Props = {
  t: (key: string) => string;
  search: string;
  status: string;
  operationType: string;
  category: string;
  priceFrom: string;
  priceTo: string;
  showArchived: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onOperationTypeChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPriceFromChange: (value: string) => void;
  onPriceToChange: (value: string) => void;
  onShowArchivedChange: (value: boolean) => void;
  onReset: () => void;
};

export function PropertiesFilters({
  t,
  search,
  status,
  operationType,
  category,
  priceFrom,
  priceTo,
  showArchived,
  onSearchChange,
  onStatusChange,
  onOperationTypeChange,
  onCategoryChange,
  onPriceFromChange,
  onPriceToChange,
  onShowArchivedChange,
  onReset,
}: Props) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('properties.quickSearch')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('properties.searchPlaceholder')}
            />
          </div>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="filters" className="border-none">
          <Card>
            <AccordionTrigger className="px-6 py-4 font-bold hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="rounded bg-primary/10 p-1">
                  <Search className="h-4 w-4 text-primary" />
                </div>
                {t('properties.advancedFilter')}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('properties.operationType')}
                  </label>
                  <Select value={operationType} onValueChange={onOperationTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('properties.operationType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('properties.allOperations')}</SelectItem>
                      <SelectItem value="sale">{t('properties.sale')}</SelectItem>
                      <SelectItem value="rent">{t('properties.rent')}</SelectItem>
                      <SelectItem value="new_build">{t('properties.newBuild')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('properties.type')}
                  </label>
                  <Select value={category} onValueChange={onCategoryChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('properties.type')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('properties.allCategories')}</SelectItem>
                      <SelectItem value="apartment">{t('properties.apartment')}</SelectItem>
                      <SelectItem value="house">{t('properties.house')}</SelectItem>
                      <SelectItem value="commercial">{t('properties.commercial')}</SelectItem>
                      <SelectItem value="land_plot">Ділянка</SelectItem>
                      <SelectItem value="other">{t('properties.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('properties.status')}
                  </label>
                  <Select value={status} onValueChange={onStatusChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('properties.status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('properties.allStatuses')}</SelectItem>
                      <SelectItem value="active">{t('properties.active')}</SelectItem>
                      <SelectItem value="sold">Продано</SelectItem>
                      <SelectItem value="rented">Здано</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="show-archived-props"
                    checked={showArchived}
                    onChange={(event) => onShowArchivedChange(event.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                  />
                  <label
                    htmlFor="show-archived-props"
                    className="cursor-pointer select-none text-sm"
                  >
                    Показати архівні
                  </label>
                </div>

                <div className="flex items-end gap-2">
                  <Input
                    type="number"
                    value={priceFrom}
                    onChange={(event) => onPriceFromChange(event.target.value)}
                    placeholder={t('properties.priceFrom')}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={priceTo}
                    onChange={(event) => onPriceToChange(event.target.value)}
                    placeholder={t('properties.priceTo')}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={onReset}>
                    {t('properties.resetFilters')}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </>
  );
}
