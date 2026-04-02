import { FormEvent, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, ImagePlus, Loader2, ArrowLeft } from 'lucide-react';
import { cloudflareApi } from '@/integrations/cloudflare/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AuthImg } from '@/components/ui/AuthImg';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { GoogleMap } from '@/components/ui/GoogleMap';
import { buildAutoPropertyTitle } from '@/lib/property-title';
import watermarkUrl from '@/assets/log.png';
import { addWatermarkToImage } from '@/lib/image-watermark';
import { getApiUrl } from '@/lib/api-url';
import { z } from 'zod';

const API_URL = getApiUrl();
const FileUploadResponseSchema = z.object({ key: z.string() });
const districts = [
  'Центр',
  '101 мікрорайон',
  'Конєва',
  'Попова',
  'Жадова',
  'Соколівка',
  'Пацаєва',
  'Волкова',
  'Дендропарк',
  'Біляєва',
  'Озерна Балка',
  'Балашівка',
  'Стара Балашівка',
  'Типографія',
  'Критий ринок',
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
  'Верхня Ковалівка',
  'Ковалівка',
  'ЖД вокзал',
  'Велика балка',
  '5/5',
  'Полтавська',
  'Миколаївка',
  'Некрасівка',
  'Лісопаркова',
  'Підгайці/Молодіжне',
  'Кущівка',
  'Катранівка',
  'Завадівка',
  'Селище нове',
  'За містом',
  'м.Кропивницький',
];
if (!districts.includes('с.Созонівка')) {
  districts.splice(Math.max(districts.length - 3, 0), 0, 'с.Созонівка');
}
const defaultCurrency = (op: string) => (op === 'rent' ? 'UAH' : 'USD');

export const PropertyFormPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streetInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    operation_type: 'sale',
    category: 'apartment',
    status: 'active',
    source: 'owner',
    district: 'Центр',
    street: '',
    building_number: '',
    block: '',
    floor: '',
    latitude: '',
    longitude: '',
    rooms: '',
    area_total: '',
    area_living: '',
    area_kitchen: '',
    land_area_sotky: '',
    floors_total: '',
    condition: 'no_repair',
    heating: 'central',
    bathroom: 'separate',
    balcony_type: 'none',
    price: '',
    currency: 'USD',
    negotiable: 'no',
    additional_costs: '',
    owner_name: '',
    owner_phones: '',
    owner_notes: '',
    agent_notes: '',
    linked_client_id: '',
    linked_deal_id: '',
    description: '',
  });

  useEffect(() => {
    const tryInit = () => {
      if (!streetInputRef.current || !window.google?.maps?.places) return;
      const acBounds = new google.maps.LatLngBounds(
        { lat: 48.45, lng: 32.17 },
        { lat: 48.57, lng: 32.34 },
      );
      const ac = new google.maps.places.Autocomplete(streetInputRef.current, {
        componentRestrictions: { country: 'ua' },
        fields: ['geometry', 'address_components'],
        bounds: acBounds,
        strictBounds: true,
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        let streetName = '',
          streetNum = '';
        (place.address_components ?? []).forEach((c: google.maps.GeocoderAddressComponent) => {
          if (c.types.includes('route')) streetName = c.long_name;
          if (c.types.includes('street_number')) streetNum = c.long_name;
        });
        setForm((p) => ({
          ...p,
          street: streetName || p.street,
          building_number: streetNum || p.building_number,
          latitude: String(lat),
          longitude: String(lng),
        }));
      });
    };
    if (window.google?.maps?.places) {
      tryInit();
    } else {
      const iv = setInterval(() => {
        if (window.google?.maps?.places) {
          tryInit();
          clearInterval(iv);
        }
      }, 600);
      return () => clearInterval(iv);
    }
  }, []);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    setUploadingPhotos(true);
    const token = localStorage.getItem('access_token');
    const newPhotos: string[] = [];
    try {
      for (let i = 0; i < Math.min(files.length, 30 - uploadedPhotos.length); i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const watermarkedFile = await addWatermarkToImage(file, watermarkUrl);
        const fd = new FormData();
        fd.append('file', watermarkedFile);
        fd.append('folder', 'properties');
        const res = await fetch(`${API_URL}/api/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const d = FileUploadResponseSchema.parse(await res.json());
          newPhotos.push(d.key);
        }
      }
      setUploadedPhotos((p) => [...p, ...newPhotos]);
      toast.success(t('property.success_upload').replace('{count}', newPhotos.length.toString()));
    } catch {
      toast.error(t('property.error_upload'));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (i: number) => setUploadedPhotos((p) => p.filter((_, idx) => idx !== i));
  const setMainPhoto = (i: number) => {
    if (i === 0) return;
    setUploadedPhotos((p) => {
      const arr = [...p];
      const [main] = arr.splice(i, 1);
      return [main, ...arr];
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await cloudflareApi.from('properties').insert({
        title:
          form.title.trim() ||
          buildAutoPropertyTitle(form.category, form.street, form.building_number),
        description: form.description || null,
        address: [form.street, form.building_number].filter(Boolean).join(', '),
        city: 'Кропивницький',
        street: form.street || null,
        building_number: form.building_number || null,
        block: form.block || null,
        floor: form.floor ? Number(form.floor) : null,
        price: form.price ? Number(form.price) : null,
        status: form.status,
        photos: uploadedPhotos,
        documents: [],
        created_by: user.id,
        manager_id: user.id,
        operation_type: form.operation_type,
        category: form.category,
        source: form.source,
        district: form.district,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        rooms: form.rooms ? Number(form.rooms) : null,
        area_total: form.area_total ? Number(form.area_total) : null,
        area_living: form.area_living ? Number(form.area_living) : null,
        area_kitchen: form.area_kitchen ? Number(form.area_kitchen) : null,
        land_area_sotky: form.land_area_sotky ? Number(form.land_area_sotky) : null,
        floors_total: form.floors_total ? Number(form.floors_total) : null,
        property_condition: form.condition,
        heating: form.heating,
        bathroom: form.bathroom,
        balcony_type: form.balcony_type,
        currency: form.currency,
        negotiable: form.negotiable === 'yes',
        additional_costs: form.additional_costs || null,
        owner_name: form.owner_name || null,
        owner_phones: form.owner_phones
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        owner_notes: form.owner_notes || null,
        agent_notes: form.agent_notes || null,
        linked_client_id: form.linked_client_id || null,
        linked_deal_id: form.linked_deal_id || null,
      });
      if (error) throw error;
      toast.success(t('property.success_create'));
      navigate('/properties');
    } catch {
      toast.error(t('property.error_create'));
    } finally {
      setLoading(false);
    }
  };

  const S = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <Button variant="ghost" asChild className="px-0">
          <Link to="/properties">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('property.back')}
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{t('property.new')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.operation')}</Label>
                  <Select
                    value={form.operation_type}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, operation_type: v, currency: defaultCurrency(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">{t('properties.sale')}</SelectItem>
                      <SelectItem value="rent">{t('properties.rent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('property.category')}</Label>
                  <Select value={form.category} onValueChange={(v) => S('category', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">{t('properties.apartment')}</SelectItem>
                      <SelectItem value="house">{t('properties.house')}</SelectItem>
                      <SelectItem value="commercial">{t('properties.commercial')}</SelectItem>
                      <SelectItem value="land_plot">{t('properties.land_plot')}</SelectItem>
                      <SelectItem value="other">{t('properties.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('property.status')}</Label>
                  <Select value={form.status} onValueChange={(v) => S('status', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('properties.active')}</SelectItem>
                      <SelectItem value="archived">{t('properties.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('property.source')}</Label>
                  <Select value={form.source} onValueChange={(v) => S('source', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">{t('property.owner_src')}</SelectItem>
                      <SelectItem value="database">{t('property.database_src')}</SelectItem>
                      <SelectItem value="partner">{t('property.partner_src')}</SelectItem>
                      <SelectItem value="other">{t('properties.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.district')}</Label>
                  <Select value={form.district} onValueChange={(v) => S('district', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('property.street')}</Label>
                  <Input
                    ref={streetInputRef}
                    required
                    value={form.street}
                    onChange={(e) => S('street', e.target.value)}
                    placeholder="вул. Велика Перспективна"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.building')}</Label>
                  <Input
                    required
                    value={form.building_number}
                    onChange={(e) => S('building_number', e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.block')}</Label>
                  <Input
                    value={form.block}
                    onChange={(e) => S('block', e.target.value)}
                    placeholder="А"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.rooms')}</Label>
                  <Input
                    type="number"
                    value={form.rooms}
                    onChange={(e) => S('rooms', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.area_total')}</Label>
                  <Input
                    type="number"
                    value={form.area_total}
                    onChange={(e) => S('area_total', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.area_living')}</Label>
                  <Input
                    type="number"
                    value={form.area_living}
                    onChange={(e) => S('area_living', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.area_kitchen')}</Label>
                  <Input
                    type="number"
                    value={form.area_kitchen}
                    onChange={(e) => S('area_kitchen', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.floor')}</Label>
                  <Input
                    type="number"
                    value={form.floor}
                    onChange={(e) => S('floor', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.floors_total')}</Label>
                  <Input
                    type="number"
                    value={form.floors_total}
                    onChange={(e) => S('floors_total', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.condition')}</Label>
                  <Select value={form.condition} onValueChange={(v) => S('condition', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_repair">{t('property.no_repair')}</SelectItem>
                      <SelectItem value="cosmetic">{t('property.cosmetic')}</SelectItem>
                      <SelectItem value="euro">{t('property.euro')}</SelectItem>
                      <SelectItem value="furnished">{t('property.furnished')}</SelectItem>
                      <SelectItem value="after_build">{t('property.after_build')}</SelectItem>
                      <SelectItem value="living_condition">Житловий стан</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('property.heating')}</Label>
                  <Select value={form.heating} onValueChange={(v) => S('heating', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="central">{t('property.central')}</SelectItem>
                      <SelectItem value="solid_fuel">Твердопаливне</SelectItem>
                      <SelectItem value="electric">{t('property.electric')}</SelectItem>
                      <SelectItem value="gas">{t('property.gas')}</SelectItem>
                      <SelectItem value="none">Відключене</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('property.bathroom')}</Label>
                  <Select value={form.bathroom} onValueChange={(v) => S('bathroom', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="separate">{t('property.separate')}</SelectItem>
                      <SelectItem value="combined">{t('property.combined')}</SelectItem>
                      <SelectItem value="two_or_more">2 і більше</SelectItem>
                      <SelectItem value="outdoor">У дворі</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.balcony')}</Label>
                  <Select value={form.balcony_type} onValueChange={(v) => S('balcony_type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('property.no')}</SelectItem>
                      <SelectItem value="balcony">{t('property.balcony_item')}</SelectItem>
                      <SelectItem value="loggia">{t('property.loggia')}</SelectItem>
                      <SelectItem value="balcony_loggia">Балкон + лоджія</SelectItem>
                      <SelectItem value="terrace">{t('property.terrace')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('property.price')}</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => S('price', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.currency')}</Label>
                  <Select value={form.currency} onValueChange={(v) => S('currency', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UAH">&#8372; UAH</SelectItem>
                      <SelectItem value="USD">$ USD</SelectItem>
                      <SelectItem value="EUR">&#8364; EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.negotiable')}</Label>
                  <Select value={form.negotiable} onValueChange={(v) => S('negotiable', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t('property.yes')}</SelectItem>
                      <SelectItem value="no">{t('property.no')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label>{t('property.additional_costs')}</Label>
                  <Input
                    value={form.additional_costs}
                    onChange={(e) => S('additional_costs', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.owner_name')}</Label>
                  <Input
                    value={form.owner_name}
                    onChange={(e) => S('owner_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.owner_phones')}</Label>
                  <Input
                    value={form.owner_phones}
                    onChange={(e) => S('owner_phones', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Сотки (для ділянок)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.land_area_sotky}
                    onChange={(e) => S('land_area_sotky', e.target.value)}
                    disabled={form.category !== 'land_plot'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.coords')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="48.513"
                      value={form.latitude}
                      onChange={(e) => S('latitude', e.target.value)}
                    />
                    <Input
                      placeholder="32.259"
                      value={form.longitude}
                      onChange={(e) => S('longitude', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="h-72 w-full">
                <GoogleMap
                  lat={Number(form.latitude)}
                  lng={Number(form.longitude)}
                  onLocationSelect={(lat, lng) =>
                    setForm((p) => ({ ...p, latitude: String(lat), longitude: String(lng) }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t('property.owner_notes')}</Label>
                <Textarea
                  value={form.owner_notes}
                  onChange={(e) => S('owner_notes', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('property.agent_notes')}</Label>
                <Textarea
                  value={form.agent_notes}
                  onChange={(e) => S('agent_notes', e.target.value)}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('property.client_id')}</Label>
                  <Input
                    value={form.linked_client_id}
                    onChange={(e) => S('linked_client_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('property.deal_id')}</Label>
                  <Input
                    value={form.linked_deal_id}
                    onChange={(e) => S('linked_deal_id', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('property.description')}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => S('description', e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>{t('property.photos')}</Label>
                <div
                  className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePhotoUpload(e.dataTransfer.files);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files)}
                  />
                  {uploadingPhotos ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{t('property.upload_prompt')}</p>
                      <p className="text-xs text-muted-foreground">{t('property.upload_hint')}</p>
                    </div>
                  )}
                </div>
                {uploadedPhotos.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4">
                    {uploadedPhotos.map((k, i) => (
                      <div
                        key={i}
                        className={`relative group aspect-square ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('photo-index', String(i))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = Number(e.dataTransfer.getData('photo-index'));
                          if (Number.isNaN(from) || from === i) return;
                          setUploadedPhotos((prev) => {
                            const next = [...prev];
                            const [moved] = next.splice(from, 1);
                            next.splice(i, 0, moved);
                            return next;
                          });
                        }}
                      >
                        <AuthImg
                          fileKey={k}
                          alt={`Фото ${i + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {i === 0 && (
                          <div className="absolute top-1 left-1 bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-tight">
                            ★
                          </div>
                        )}
                        {i !== 0 && (
                          <button
                            type="button"
                            onClick={() => setMainPhoto(i)}
                            title="Зробити головним"
                            className="absolute top-1 left-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ⭐
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('property.uploaded_count')}: {uploadedPhotos.length} / 30
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full gradient-primary">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  t('property.create')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};
