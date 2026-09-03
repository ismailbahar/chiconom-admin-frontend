import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, ExternalLink, Image as ImageIcon, Loader2,
  Package, Plus, Save, Star, Trash2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import StatusBadge from '@/components/panel/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SmartImage from '@/components/SmartImage';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatPrice } from '@/lib/utils';

interface Variant {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  list_price: number | null;
  stock: number;
  image: string | null;
  is_active: boolean;
  sold: boolean;
  options: Array<{ option: string | null; value: string | null; color: string | null }>;
}

interface FormOptions {
  categories: Array<{ id: number; name: string; selectable: boolean }>;
  brands: Array<{ id: number; name: string }>;
  tax_rates: number[];
}

/** Formda tutulan alanlar — sunucuya olduğu gibi gönderilir. */
type Form = Record<string, unknown>;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Yayında' },
  { value: 'draft', label: 'Taslak' },
  { value: 'passive', label: 'Pasif' },
];

/** Yeni ürün formunun başlangıç değerleri. */
const BOS_FORM: Record<string, unknown> = {
  name: '', sku: '', barcode: '', category_id: '', brand_id: '',
  short_description: '', description: '', list_price: '', price: '', cost_price: '',
  tax_rate: 20, stock: 0, low_stock_threshold: 5, track_stock: true, allow_backorder: false,
  max_per_order: '', weight: '', length: '', width: '', height: '', free_shipping: true, prep_days: 1,
  cover_image: '', status: 'draft', is_featured: false, is_new: true, meta_title: '', meta_description: '',
};

/**
 * ÜRÜN DÜZENLEME / OLUŞTURMA.
 *
 * `/urunler/yeni` adresinde boş formla açılır; ilk kayıttan sonra ürünün
 * kendi adresine geçer (varyant ve görsel yükleme ancak o zaman mümkündür).
 *
 * Kaydetme SEKME BAZINDA değil, tüm form için tektir: kullanıcı sekmeler
 * arasında gezip sonunda bir kez kaydeder. Sekme başına kaydet düğmesi,
 * "diğer sekmedeki değişikliğim gitti mi" sorusunu doğurur.
 */
export default function AdminProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'yeni';
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Form>({});
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => (await adminApi.get(`/products/${id}`)).data.data,
    enabled: Boolean(id) && !isNew,
  });

  const { data: options } = useQuery<FormOptions>({
    queryKey: ['admin-product-form-options'],
    queryFn: async () => (await adminApi.get('/products/form-options')).data,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (isNew) {
      setForm(BOS_FORM);
      setImages([]);
      setVariants([]);
      setDirty(false);
      document.title = 'Yeni Ürün — Chiconom Yönetim';

      return;
    }

    if (!data) return;

    setForm({
      name: data.name ?? '', sku: data.sku ?? '', barcode: data.barcode ?? '',
      category_id: data.category_id ?? '', brand_id: data.brand_id ?? '',
      short_description: data.short_description ?? '', description: data.description ?? '',
      list_price: data.list_price ?? '', price: data.price ?? '', cost_price: data.cost_price ?? '',
      tax_rate: data.tax_rate ?? 20, stock: data.stock ?? 0,
      low_stock_threshold: data.low_stock_threshold ?? 5,
      track_stock: Boolean(data.track_stock), allow_backorder: Boolean(data.allow_backorder),
      max_per_order: data.max_per_order ?? '',
      weight: data.weight ?? '', length: data.length ?? '', width: data.width ?? '', height: data.height ?? '',
      free_shipping: Boolean(data.free_shipping), prep_days: data.prep_days ?? 0,
      cover_image: data.cover_image ?? '', status: data.status ?? 'draft',
      is_featured: Boolean(data.is_featured), is_new: Boolean(data.is_new),
      meta_title: data.meta_title ?? '', meta_description: data.meta_description ?? '',
    });

    setImages((data.images ?? []).map((i: { path: string }) => i.path));
    setVariants(data.variants ?? []);
    setDirty(false);

    document.title = `${data.name} — Chiconom Yönetim`;
  }, [data, isNew]);

  const set = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const kaydet = async () => {
    setSaving(true);

    try {
      const payload: Form = { ...form, images };

      // Boş metin alanları null gitsin — '' sayısal alanlarda hataya düşer
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (isNew) {
        const { data: res } = await adminApi.post('/products', payload);
        toast.success(res.message ?? 'Ürün oluşturuldu.');
        setDirty(false);
        navigate(`/urunler/${res.data?.id ?? res.id}`, { replace: true });

        return;
      }

      const { data: res } = await adminApi.patch(`/products/${id}`, payload);
      toast.success(res.message);
      setDirty(false);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const gorselYukle = async (files: FileList) => {
    setUploading(true);

    try {
      const fd = new FormData();
      Array.from(files).slice(0, 12).forEach((f) => fd.append('files[]', f));
      fd.append('folder', 'urunler');

      const { data: res } = await adminApi.post('/media', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const yeni = (res.uploaded ?? []).map((u: { path: string }) => u.path);
      setImages((g) => [...g, ...yeni]);
      setDirty(true);

      if (res.failed?.length) {
        res.failed.forEach((f: { name: string; error: string }) => toast.error(`${f.name}: ${f.error}`));
      } else {
        toast.success(`${yeni.length} görsel eklendi. Kaydetmeyi unutmayın.`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const varyantIstek = async (fn: () => Promise<{ data: { message: string; data: Variant[] } }>) => {
    try {
      const { data: res } = await fn();
      toast.success(res.message);
      setVariants(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const stokToplam = useMemo(
    () => (variants.length ? variants.reduce((s, v) => s + v.stock, 0) : Number(form.stock ?? 0)),
    [variants, form.stock],
  );

  if (!isNew && (isLoading || !data)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'Yeni Ürün' : String(data.name)}
        description={isNew ? 'Ürünü kaydettikten sonra görsel ve varyant ekleyebilirsiniz.' : `${data.brand?.name ?? 'Markasız'} · ${data.category?.name ?? 'Kategorisiz'}`}
        icon={Package}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && <StatusBadge status={String(data.status)} />}
            <Button variant="outline" size="sm" asChild>
              <Link to="/urunler"><ArrowLeft className="size-4" /> Listeye dön</Link>
            </Button>
            <Button size="sm" className="gap-1.5" disabled={saving || !dirty} onClick={kaydet}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {dirty ? 'Kaydet' : 'Kaydedildi'}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="genel">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="fiyat">Fiyat & Stok</TabsTrigger>
          {!isNew && <TabsTrigger value="gorseller">Görseller ({images.length})</TabsTrigger>}
          {!isNew && <TabsTrigger value="varyantlar">Varyantlar ({variants.length})</TabsTrigger>}
          <TabsTrigger value="kargo">Kargo</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        {/* ══ GENEL ═══════════════════════════════════════════════════ */}
        <TabsContent value="genel">
          <Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ürün adı" className="md:col-span-2">
                <Input value={String(form.name ?? '')} onChange={(e) => set('name', e.target.value)} />
              </Field>

              <Field label="Kategori" hint="Ürünler yalnız en alt kategoriye bağlanmalı.">
                <Select value={form.category_id} onChange={(v) => set('category_id', v)}>
                  <option value="">Seçilmedi</option>
                  {options?.categories.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.selectable}>{c.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Marka">
                <Select value={form.brand_id} onChange={(v) => set('brand_id', v)}>
                  <option value="">Markasız</option>
                  {options?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>

              <Field label="SKU (stok kodu)">
                <Input value={String(form.sku ?? '')} onChange={(e) => set('sku', e.target.value)} className="font-mono text-sm" />
              </Field>

              <Field label="Barkod (GTIN/EAN)">
                <Input value={String(form.barcode ?? '')} onChange={(e) => set('barcode', e.target.value)} className="font-mono text-sm" />
              </Field>

              <Field label="Kısa açıklama" hint="Ürün kartında ve listelerde görünür." className="md:col-span-2">
                <Input value={String(form.short_description ?? '')} onChange={(e) => set('short_description', e.target.value)} />
              </Field>

              <Field label="Açıklama" hint="HTML kullanabilirsiniz: <h2>, <p>, <ul>, <strong>." className="md:col-span-2">
                <textarea
                  value={String(form.description ?? '')}
                  onChange={(e) => set('description', e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs
                             focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>

              <Field label="Durum">
                <Select value={form.status} onChange={(v) => set('status', v)}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>

              <div className="flex items-end gap-4 pb-2">
                <Check label="Öne çıkan" checked={Boolean(form.is_featured)} onChange={(v) => set('is_featured', v)} />
                <Check label="Yeni ürün" checked={Boolean(form.is_new)} onChange={(v) => set('is_new', v)} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ══ FİYAT & STOK ════════════════════════════════════════════ */}
        <TabsContent value="fiyat">
          <Card>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Satış fiyatı (TL)">
                <Input type="number" step="0.01" value={String(form.price ?? '')} onChange={(e) => set('price', e.target.value)} />
              </Field>

              <Field label="Piyasa fiyatı (TL)" hint="Üstü çizili gösterilir. Satış fiyatından büyük olmalı.">
                <Input type="number" step="0.01" value={String(form.list_price ?? '')} onChange={(e) => set('list_price', e.target.value)} />
              </Field>

              <Field label="Alış maliyeti (TL)" hint="Yalnız raporlarda kullanılır, vitrinde görünmez.">
                <Input type="number" step="0.01" value={String(form.cost_price ?? '')} onChange={(e) => set('cost_price', e.target.value)} />
              </Field>

              <Field label="KDV oranı (%)">
                <Select value={form.tax_rate} onChange={(v) => set('tax_rate', v)}>
                  {(options?.tax_rates ?? [0, 1, 10, 20]).map((t) => <option key={t} value={t}>%{t}</option>)}
                </Select>
              </Field>

              <Field
                label="Stok"
                hint={variants.length
                  ? 'Varyantlı üründe geçerli stok varyantların toplamıdır.'
                  : 'Değişiklik stok defterine hareket olarak yazılır.'}
              >
                <Input
                  type="number" min="0"
                  value={String(form.stock ?? 0)}
                  onChange={(e) => set('stock', e.target.value)}
                  disabled={variants.length > 0}
                />
              </Field>

              <Field label="Kritik stok eşiği" hint="Bu değerin altında uyarı verilir.">
                <Input type="number" min="0" value={String(form.low_stock_threshold ?? 5)} onChange={(e) => set('low_stock_threshold', e.target.value)} />
              </Field>

              <Field label="Sepette en fazla" hint="Boş bırakılırsa sınır yok.">
                <Input type="number" min="1" value={String(form.max_per_order ?? '')} onChange={(e) => set('max_per_order', e.target.value)} />
              </Field>

              <div className="flex items-end gap-4 pb-2 md:col-span-2">
                <Check label="Stok takibi yapılsın" checked={Boolean(form.track_stock)} onChange={(v) => set('track_stock', v)} />
                <Check label="Stok bitse de satılsın" checked={Boolean(form.allow_backorder)} onChange={(v) => set('allow_backorder', v)} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 rounded-xl bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">Toplam stok: <strong className="text-foreground">{stokToplam}</strong></span>
              <span className="text-muted-foreground">Rezerve: <strong className="text-foreground">{data?.reserved_stock ?? 0}</strong></span>
              <span className="text-muted-foreground">Satılan: <strong className="text-foreground">{data?.sold_count ?? 0}</strong></span>
              {Number(form.list_price) > Number(form.price) && (
                <span className="text-success">
                  İndirim: %{Math.round((1 - Number(form.price) / Number(form.list_price)) * 100)}
                </span>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ══ GÖRSELLER ═══════════════════════════════════════════════ */}
        <TabsContent value="gorseller">
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button className="gap-1.5" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Görsel Yükle
              </Button>
              <input
                ref={fileInput} type="file" accept="image/*" multiple hidden
                onChange={(e) => e.target.files && gorselYukle(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                Yüklenen görseller otomatik WebP'ye çevrilir. Yıldıza tıklayarak kapak seçin.
              </p>
            </div>

            {images.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                <ImageIcon className="size-6" />
                Bu ürünün görseli yok.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {images.map((path, i) => {
                  const kapak = form.cover_image === path;

                  return (
                    <div key={path + i} className={cn(
                      'group relative aspect-square overflow-hidden rounded-xl border bg-muted',
                      kapak ? 'border-brand ring-2 ring-brand/30' : 'border-border',
                    )}>
                      <SmartImage src={path} alt="" imgClassName="object-contain" />

                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-background/85 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          title={kapak ? 'Kapak görseli' : 'Kapak yap'}
                          onClick={() => set('cover_image', path)}
                          className={cn('rounded p-1', kapak ? 'text-brand' : 'text-muted-foreground hover:text-brand')}
                        >
                          <Star className={cn('size-3.5', kapak && 'fill-brand')} />
                        </button>

                        <span className="text-[10px] text-muted-foreground">{i + 1}</span>

                        <button
                          title="Galeriden çıkar"
                          onClick={() => {
                            setImages((g) => g.filter((_, idx) => idx !== i));
                            if (kapak) set('cover_image', '');
                            setDirty(true);
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>

                      {kapak && (
                        <Badge variant="deal" className="absolute left-1 top-1 text-[9px]">KAPAK</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Galeriden çıkarılan görsel diskten silinmez, yalnız üründen kopar —
              başka üründe de kullanılıyor olabilir. Kalıcı silme Medya Merkezi'nden yapılır.
            </p>
          </Card>
        </TabsContent>

        {/* ══ VARYANTLAR ══════════════════════════════════════════════ */}
        <TabsContent value="varyantlar">
          <VariantEditor
            productId={Number(id)}
            variants={variants}
            onRequest={varyantIstek}
          />
        </TabsContent>

        {/* ══ KARGO ═══════════════════════════════════════════════════ */}
        <TabsContent value="kargo">
          <Card>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Ağırlık (kg)">
                <Input type="number" step="0.001" value={String(form.weight ?? '')} onChange={(e) => set('weight', e.target.value)} />
              </Field>
              <Field label="Uzunluk (cm)">
                <Input type="number" value={String(form.length ?? '')} onChange={(e) => set('length', e.target.value)} />
              </Field>
              <Field label="Genişlik (cm)">
                <Input type="number" value={String(form.width ?? '')} onChange={(e) => set('width', e.target.value)} />
              </Field>
              <Field label="Yükseklik (cm)">
                <Input type="number" value={String(form.height ?? '')} onChange={(e) => set('height', e.target.value)} />
              </Field>

              <Field label="Hazırlık süresi (gün)" hint="0 = aynı gün kargoya verilir. Ürün sayfasındaki teslimat tahminine yansır.">
                <Input type="number" min="0" max="30" value={String(form.prep_days ?? 0)} onChange={(e) => set('prep_days', e.target.value)} />
              </Field>

              <div className="flex items-end pb-2 md:col-span-3">
                <Check label="Kargo bedava" checked={Boolean(form.free_shipping)} onChange={(v) => set('free_shipping', v)} />
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Desi hesabı ağırlık ve boyutlardan yapılır; kargo entegrasyonunda gönderi
              ücreti buna göre hesaplanır.
            </p>
          </Card>
        </TabsContent>

        {/* ══ SEO ═════════════════════════════════════════════════════ */}
        <TabsContent value="seo">
          <Card>
            <div className="grid gap-4">
              <Field label="Sayfa başlığı (title)" hint="Boş bırakılırsa ürün adı kullanılır. 60 karakteri geçmeyin.">
                <Input value={String(form.meta_title ?? '')} onChange={(e) => set('meta_title', e.target.value)} maxLength={191} />
              </Field>

              <Field label="Açıklama (meta description)" hint="Arama sonucunda görünen metin. 155 karakter civarı idealdir.">
                <textarea
                  value={String(form.meta_description ?? '')}
                  onChange={(e) => set('meta_description', e.target.value)}
                  rows={3} maxLength={500}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>

              <div className="rounded-xl border border-border p-3">
                <p className="mb-1 text-xs text-muted-foreground">Arama sonucunda böyle görünecek:</p>
                <p className="text-sm text-brand">{String(form.meta_title || form.name)}</p>
                <p className="text-xs text-success">chiconom.com/urun/{String(data?.slug ?? 'yeni-urun')}</p>
                <p className="text-xs text-muted-foreground">
                  {String(form.meta_description || form.short_description || '—')}
                </p>
              </div>

              {!isNew && (
              <a
                href={`${import.meta.env.VITE_STORE_URL ?? 'http://localhost:5180'}/urun/${data.slug}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
              >
                Vitrinde görüntüle <ExternalLink className="size-3.5" />
              </a>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {dirty && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-brand bg-card p-3 shadow-lg">
          <span className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-warning" />
            Kaydedilmemiş değişiklikleriniz var.
          </span>
          <Button size="sm" disabled={saving} onClick={kaydet}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Kaydet
          </Button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4">{children}</div>;
}

function Field({
  label, hint, children, className,
}: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Select({
  value, onChange, children,
}: { value: unknown; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm
                 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {children}
    </select>
  );
}

function Check({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand" />
      <span className="text-xs font-semibold">{label}</span>
    </label>
  );
}

/**
 * VARYANT DÜZENLEYİCİ.
 *
 * Varyant işlemleri ürün formundan AYRI kaydedilir — anında sunucuya gider.
 * Sebebi: varyant ekleyip ürünü kaydetmeden sayfadan çıkan kullanıcı,
 * varyantın kaybolduğunu görürdü. Ekle/sil gibi ayrık işlemlerin taslakta
 * bekletilmesi beklenti kırar.
 */
function VariantEditor({
  productId, variants, onRequest,
}: {
  productId: number;
  variants: Variant[];
  /**
   * Varyant listesini tazeleyen tek yol budur: sunucu her işlemden sonra
   * GÜNCEL listeyi döndürür ve çağıran onu doğrudan duruma yazar. Ayrı bir
   * `onChange` daha vardı ama hiç çağrılmıyordu — iki tazeleme yolu olsaydı
   * hangisinin kazandığı belirsiz kalırdı.
   */
  onRequest: (fn: () => Promise<{ data: { message: string; data: Variant[] } }>) => Promise<void>;
}) {
  const [yeni, setYeni] = useState({ name: '', sku: '', stock: '0', price: '', option: '', value: '', color: '' });
  const [busy, setBusy] = useState(false);

  const ekle = async () => {
    if (!yeni.name.trim()) { toast.error('Varyant adı gerekli (örn. "Kırmızı / XL").'); return; }

    setBusy(true);

    await onRequest(() => adminApi.post(`/products/${productId}/variants`, {
      name: yeni.name,
      sku: yeni.sku || null,
      stock: Number(yeni.stock) || 0,
      price: yeni.price ? Number(yeni.price) : null,
      options: yeni.option && yeni.value
        ? [{ option: yeni.option, value: yeni.value, color: yeni.color || null }]
        : [],
    }));

    setYeni({ name: '', sku: '', stock: '0', price: '', option: '', value: '', color: '' });
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 text-sm font-black">Varyantlar</h3>

        {variants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Bu ürünün varyantı yok. Tek renkli ürünlerde varyant gerekmez; rengi "Özellikler" ile belirtin.
          </p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  {['Varyant', 'Seçenekler', 'SKU', 'Fiyat', 'Stok', 'Yayında', ''].map((h, i) => (
                    <th key={h} className={cn(
                      'whitespace-nowrap px-2 py-2 text-[11px] font-bold uppercase text-muted-foreground',
                      i > 2 ? 'text-right' : 'text-left',
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 font-semibold">{v.name}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {v.options.map((o, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} />}
                            {o.option}: {o.value}
                          </span>
                        ))}
                        {v.options.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{v.sku ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {v.price !== null ? formatPrice(v.price) : <span className="text-muted-foreground">ana fiyat</span>}
                    </td>
                    <td className={cn('px-2 py-2 text-right tabular-nums', v.stock === 0 && 'font-bold text-destructive')}>
                      {v.stock}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="checkbox" checked={v.is_active} className="size-4 accent-brand"
                        onChange={(e) => onRequest(() => adminApi.patch(
                          `/products/${productId}/variants/${v.id}`, { is_active: e.target.checked },
                        ))}
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="ghost" size="icon"
                        title={v.sold ? 'Satış yapılmış — yalnız yayından kaldırılır' : 'Sil'}
                        onClick={() => {
                          if (!confirm(v.sold
                            ? 'Bu varyanttan satış yapılmış. Silinemez, yayından kaldırılacak. Devam edilsin mi?'
                            : `"${v.name}" varyantı silinecek. Onaylıyor musunuz?`)) return;
                          onRequest(() => adminApi.delete(`/products/${productId}/variants/${v.id}`));
                        }}
                      >
                        <Trash2 className={cn('size-3.5', v.sold ? 'text-muted-foreground' : 'text-destructive')} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-black">Yeni varyant ekle</h3>

        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Varyant adı" hint='Örn. "Kırmızı / XL"'>
            <Input value={yeni.name} onChange={(e) => setYeni({ ...yeni, name: e.target.value })} />
          </Field>
          <Field label="SKU">
            <Input value={yeni.sku} onChange={(e) => setYeni({ ...yeni, sku: e.target.value })} className="font-mono text-xs" />
          </Field>
          <Field label="Stok">
            <Input type="number" min="0" value={yeni.stock} onChange={(e) => setYeni({ ...yeni, stock: e.target.value })} />
          </Field>
          <Field label="Fiyat (TL)" hint="Boş bırakılırsa ana ürün fiyatı geçerli.">
            <Input type="number" step="0.01" value={yeni.price} onChange={(e) => setYeni({ ...yeni, price: e.target.value })} />
          </Field>

          <Field label="Seçenek" hint="Örn. Renk">
            <Input value={yeni.option} onChange={(e) => setYeni({ ...yeni, option: e.target.value })} />
          </Field>
          <Field label="Değer" hint="Örn. Kırmızı">
            <Input value={yeni.value} onChange={(e) => setYeni({ ...yeni, value: e.target.value })} />
          </Field>
          <Field label="Renk kodu" hint="Renk seçeneğinde palet göstermek için.">
            <Input type="color" value={yeni.color || '#7c3aed'} onChange={(e) => setYeni({ ...yeni, color: e.target.value })} className="h-9 p-1" />
          </Field>

          <div className="flex items-end pb-2">
            <Button className="w-full gap-1.5" disabled={busy} onClick={ekle}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ekle
            </Button>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Seçenek ve değer katalogda yoksa oluşturulur; aynı isim ikinci kez yazıldığında
          mevcut değere bağlanır — vitrindeki renk/beden filtresi ancak böyle çalışır.
          Varyant işlemleri anında kaydedilir.
        </p>
      </Card>
    </div>
  );
}
