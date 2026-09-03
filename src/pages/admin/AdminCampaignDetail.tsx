import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Loader2, Pause, Play, Plus, Save,
  Search, Trash2, Zap,
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

interface CampaignProduct {
  id: number;
  product_id: number;
  name: string | null;
  slug: string | null;
  image: string | null;
  original_price: number;
  campaign_price: number;
  discount_percent: number;
  stock_limit: number | null;
  sold_count: number;
  is_active: boolean;
}

const DISCOUNT_TYPES = [
  { value: 'percent', label: 'Yüzde indirim', hint: 'Örn. 20 → %20 indirim' },
  { value: 'amount', label: 'Tutar indirimi', hint: 'Örn. 500 → 500 TL düş' },
  { value: 'fixed_price', label: 'Sabit fiyat', hint: 'Örn. 999 → hepsi 999 TL' },
  { value: 'none', label: 'İndirim yok', hint: 'Yalnız vitrin gruplaması' },
];

/**
 * KAMPANYA DÜZENLEME.
 *
 * İndirim, kampanyaya ürün EKLENDİĞİ anda ürünün fiyatına uygulanır ve
 * `campaign_price` alanına yazılır. Yani indirim kuralını sonradan
 * değiştirmek, önceden eklenmiş ürünleri kendiliğinden güncellemez —
 * ekran bunu açıkça söyler, çünkü sessiz kalması "indirimi değiştirdim
 * ama vitrin eski fiyatı gösteriyor" şikâyetinin kaynağıdır.
 */
export default function AdminCampaignDetail() {
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-campaign', id],
    queryFn: async () => (await adminApi.get(`/campaigns/${id}`)).data,
    enabled: Boolean(id),
  });

  const c = data?.data;
  const products: CampaignProduct[] = data?.products ?? [];

  useEffect(() => {
    if (!c) return;

    setForm({
      title: c.title ?? '', subtitle: c.subtitle ?? '', description: c.description ?? '',
      image: c.image ?? '', badge_text: c.badge_text ?? '', badge_color: c.badge_color ?? '#DB2777',
      theme_color: c.theme_color ?? '#7C3AED',
      discount_type: c.discount_type ?? 'percent', discount_value: c.discount_value ?? '',
      max_discount: c.max_discount ?? '',
      starts_at: c.starts_at ? String(c.starts_at).slice(0, 16) : '',
      ends_at: c.ends_at ? String(c.ends_at).slice(0, 16) : '',
      show_countdown: Boolean(c.show_countdown), stock_limit: c.stock_limit ?? '',
      per_customer_limit: c.per_customer_limit ?? '',
      is_featured: Boolean(c.is_featured), show_in_home: Boolean(c.show_in_home),
      meta_title: c.meta_title ?? '', meta_description: c.meta_description ?? '',
    });

    setDirty(false);
    document.title = `${c.title} — Chiconom Yönetim`;
  }, [c]);

  const set = (k: string, v: unknown) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };

  const istek = async (fn: () => Promise<{ data: { message: string } }>) => {
    setBusy(true);

    try {
      const { data: res } = await fn();
      toast.success(res.message);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const kaydet = async () => {
    setSaving(true);

    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

      const { data: res } = await adminApi.patch(`/campaigns/${id}`, payload);
      toast.success(res.message);
      setDirty(false);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !c) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-brand" /></div>;
  }

  const yayinda = c.status === 'active';

  return (
    <div>
      <PageHeader
        title={String(c.title)}
        description={`${products.length} ürün · ${c.status === 'active' ? 'yayında' : 'yayında değil'}`}
        icon={Zap}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={String(c.status)} />

            <Button variant="outline" size="sm" asChild>
              <Link to="/kampanyalar"><ArrowLeft className="size-4" /> Listeye dön</Link>
            </Button>

            {['active', 'paused', 'draft'].includes(String(c.status)) && (
              <Button
                variant="outline" size="sm" className="gap-1.5" disabled={busy}
                onClick={() => istek(() => adminApi.post(`/campaigns/${id}/toggle`))}
              >
                {yayinda ? <Pause className="size-4" /> : <Play className="size-4" />}
                {yayinda ? 'Duraklat' : 'Yayına Al'}
              </Button>
            )}

            <Button size="sm" className="gap-1.5" disabled={saving || !dirty} onClick={kaydet}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {dirty ? 'Kaydet' : 'Kaydedildi'}
            </Button>
          </div>
        }
      />

      {products.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            <strong>Bu kampanyada hiç ürün yok.</strong> Yayına alınsa bile vitrinde
            boş görünür. "Ürünler" sekmesinden ekleyin.
          </p>
        </div>
      )}

      <Tabs defaultValue="urunler">
        <TabsList className="mb-4">
          <TabsTrigger value="urunler">Ürünler ({products.length})</TabsTrigger>
          <TabsTrigger value="genel">Genel</TabsTrigger>
          <TabsTrigger value="indirim">İndirim & Süre</TabsTrigger>
          <TabsTrigger value="gorunum">Görünüm</TabsTrigger>
        </TabsList>

        {/* ══ ÜRÜNLER ═════════════════════════════════════════════════ */}
        <TabsContent value="urunler">
          <ProductPicker campaignId={Number(id)} onAdded={refetch} />

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-black">Kampanyadaki Ürünler</h3>

            {products.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Henüz ürün eklenmedi.</p>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      {['Ürün', 'Normal', 'Kampanya', 'İndirim', 'Stok limiti', 'Satılan', ''].map((h, i) => (
                        <th key={h} className={cn(
                          'whitespace-nowrap px-2 py-2 text-[11px] font-bold uppercase text-muted-foreground',
                          i === 0 ? 'text-left' : 'text-right',
                        )}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="size-9 shrink-0 overflow-hidden rounded bg-muted">
                              <SmartImage src={p.image} alt={p.name ?? ''} imgClassName="object-contain p-0.5" />
                            </div>
                            <span className="line-clamp-1 font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground line-through">
                          {formatPrice(p.original_price)}
                        </td>
                        <td className="px-2 py-2 text-right font-bold tabular-nums text-brand">
                          {formatPrice(p.campaign_price)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Badge variant="deal">%{p.discount_percent}</Badge>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.stock_limit ?? '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{p.sold_count}</td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            variant="ghost" size="icon" title="Kampanyadan çıkar" disabled={busy}
                            onClick={() => {
                              if (!confirm(`"${p.name}" kampanyadan çıkarılacak. Ürünün kampanya fiyatı da kaldırılır.`)) return;
                              istek(() => adminApi.delete(`/campaigns/${id}/products/${p.id}`));
                            }}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Kampanya fiyatı, ürün eklendiğinde hesaplanır; indirim kuralı veya tarih
              değiştirilip kaydedildiğinde tüm kampanya ürünleri yeniden hesaplanır.
            </p>
          </div>
        </TabsContent>

        {/* ══ GENEL ═══════════════════════════════════════════════════ */}
        <TabsContent value="genel">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Kampanya başlığı" className="md:col-span-2">
                <Input value={String(form.title ?? '')} onChange={(e) => set('title', e.target.value)} />
              </Field>

              <Field label="Alt başlık" className="md:col-span-2">
                <Input value={String(form.subtitle ?? '')} onChange={(e) => set('subtitle', e.target.value)} />
              </Field>

              <Field label="Açıklama" className="md:col-span-2">
                <textarea
                  value={String(form.description ?? '')}
                  onChange={(e) => set('description', e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>

              <Field label="Sayfa başlığı (SEO)">
                <Input value={String(form.meta_title ?? '')} onChange={(e) => set('meta_title', e.target.value)} />
              </Field>

              <Field label="Meta açıklama (SEO)">
                <Input value={String(form.meta_description ?? '')} onChange={(e) => set('meta_description', e.target.value)} />
              </Field>
            </div>
          </div>
        </TabsContent>

        {/* ══ İNDİRİM ═════════════════════════════════════════════════ */}
        <TabsContent value="indirim">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="İndirim türü"
                hint={DISCOUNT_TYPES.find((d) => d.value === form.discount_type)?.hint}
              >
                <select
                  value={String(form.discount_type ?? 'percent')}
                  onChange={(e) => set('discount_type', e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {DISCOUNT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>

              <Field label="İndirim değeri">
                <Input
                  type="number" step="0.01"
                  value={String(form.discount_value ?? '')}
                  onChange={(e) => set('discount_value', e.target.value)}
                  disabled={form.discount_type === 'none'}
                />
              </Field>

              <Field label="En fazla indirim (TL)" hint="Yüzde indirimde tavan koymak için.">
                <Input
                  type="number" step="0.01"
                  value={String(form.max_discount ?? '')}
                  onChange={(e) => set('max_discount', e.target.value)}
                  disabled={form.discount_type !== 'percent'}
                />
              </Field>

              <Field label="Başlangıç">
                <Input type="datetime-local" value={String(form.starts_at ?? '')} onChange={(e) => set('starts_at', e.target.value)} />
              </Field>

              <Field label="Bitiş" hint="Geri sayım bu tarihe göre çalışır.">
                <Input type="datetime-local" value={String(form.ends_at ?? '')} onChange={(e) => set('ends_at', e.target.value)} />
              </Field>

              <Field label="Toplam stok limiti" hint="Kampanyada satılabilecek toplam adet.">
                <Input type="number" min="1" value={String(form.stock_limit ?? '')} onChange={(e) => set('stock_limit', e.target.value)} />
              </Field>

              <Field label="Kişi başı limit" hint="Bir müşteri en fazla kaç adet alabilir.">
                <Input type="number" min="1" value={String(form.per_customer_limit ?? '')} onChange={(e) => set('per_customer_limit', e.target.value)} />
              </Field>

              <div className="flex items-end pb-2">
                <Check2 label="Geri sayım göster" checked={Boolean(form.show_countdown)} onChange={(v) => set('show_countdown', v)} />
              </div>
            </div>

            {Boolean(c.stock_limit) && (
              <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm">
                Satılan: <strong>{c.sold_count}</strong> / {c.stock_limit} ·
                <span className="ml-1 text-muted-foreground">stok tükendiğinde kampanya kendiliğinden kapanır</span>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══ GÖRÜNÜM ═════════════════════════════════════════════════ */}
        <TabsContent value="gorunum">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Kampanya görseli (yol)" className="md:col-span-3" hint="Medya Merkezi'nden yüklediğiniz görselin yolu.">
                <Input value={String(form.image ?? '')} onChange={(e) => set('image', e.target.value)} className="font-mono text-xs" />
              </Field>

              <Field label="Rozet metni" hint='Örn. "SON 3 GÜN"'>
                <Input value={String(form.badge_text ?? '')} onChange={(e) => set('badge_text', e.target.value)} maxLength={40} />
              </Field>

              <Field label="Rozet rengi">
                <Input type="color" value={String(form.badge_color ?? '#DB2777')} onChange={(e) => set('badge_color', e.target.value)} className="h-9 p-1" />
              </Field>

              <Field label="Tema rengi" hint="Kampanya sayfasının vurgu rengi.">
                <Input type="color" value={String(form.theme_color ?? '#7C3AED')} onChange={(e) => set('theme_color', e.target.value)} className="h-9 p-1" />
              </Field>

              <div className="flex items-end gap-4 pb-2 md:col-span-3">
                <Check2 label="Anasayfada göster" checked={Boolean(form.show_in_home)} onChange={(v) => set('show_in_home', v)} />
                <Check2 label="Öne çıkan kampanya" checked={Boolean(form.is_featured)} onChange={(v) => set('is_featured', v)} />
              </div>
            </div>

            {Boolean(form.image) && (
              <div className="mt-4">
                <p className="mb-1 text-xs text-muted-foreground">Önizleme:</p>
                <div className="relative h-40 w-full max-w-md overflow-hidden rounded-xl bg-muted">
                  <SmartImage src={String(form.image)} alt="" imgClassName="object-cover" />
                  {Boolean(form.badge_text) && (
                    <span
                      className="absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-bold text-white"
                      style={{ background: String(form.badge_color) }}
                    >
                      {String(form.badge_text)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {dirty && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-brand bg-card p-3 shadow-lg">
          <span className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-warning" /> Kaydedilmemiş değişiklikleriniz var.
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

function Check2({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand" />
      <span className="text-xs font-semibold">{label}</span>
    </label>
  );
}

/**
 * ÜRÜN SEÇİCİ.
 *
 * Kampanyaya ürün eklemenin tek yolu. Arama sunucuda yapılır: katalog
 * büyüdüğünde tüm ürünleri tarayıcıya indirip filtrelemek çalışmaz.
 */
function ProductPicker({ campaignId, onAdded }: { campaignId: number; onAdded: () => void }) {
  const [term, setTerm] = useState('');
  const [secili, setSecili] = useState<number[]>([]);
  const [stokLimiti, setStokLimiti] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['campaign-product-search', term],
    queryFn: async () => (await adminApi.get('/products', {
      params: { q: term, status: 'active', per_page: 12 },
    })).data,
    enabled: term.trim().length >= 2,
  });

  const sonuclar = data?.data ?? [];

  const ekle = async () => {
    if (secili.length === 0) return;

    setBusy(true);

    try {
      const { data: res } = await adminApi.post(`/campaigns/${campaignId}/products`, {
        product_ids: secili,
        stock_limit: stokLimiti ? Number(stokLimiti) : null,
      });

      toast.success(res.message);
      setSecili([]);
      setTerm('');
      onAdded();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-black">Kampanyaya ürün ekle</h3>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ürün adı, SKU veya barkod (en az 2 karakter)…"
            className="pl-8"
          />
        </div>

        <Input
          type="number" min="1" value={stokLimiti}
          onChange={(e) => setStokLimiti(e.target.value)}
          placeholder="Ürün başı stok limiti"
          className="w-44"
        />

        <Button className="gap-1.5" disabled={busy || secili.length === 0} onClick={ekle}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {secili.length > 0 ? `${secili.length} ürünü ekle` : 'Ekle'}
        </Button>
      </div>

      {term.trim().length >= 2 && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border scrollbar-thin">
          {isFetching ? (
            <div className="flex h-24 items-center justify-center"><Loader2 className="size-5 animate-spin text-brand" /></div>
          ) : sonuclar.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Eşleşen ürün yok.</p>
          ) : (
            sonuclar.map((p: { id: number; name: string; cover_image: string | null; price: number; category: string | null; stock: number }) => {
              const isaretli = secili.includes(p.id);

              return (
                <button
                  key={p.id}
                  onClick={() => setSecili((s) => (isaretli ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                  className={cn(
                    'flex w-full items-center gap-2 border-b border-border p-2 text-left last:border-0 hover:bg-muted/40',
                    isaretli && 'bg-brand-soft',
                  )}
                >
                  <input type="checkbox" checked={isaretli} readOnly className="size-4 accent-brand" />
                  <div className="size-9 shrink-0 overflow-hidden rounded bg-muted">
                    <SmartImage src={p.cover_image} alt={p.name} imgClassName="object-contain p-0.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.category ?? 'Kategorisiz'} · stok {p.stock}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatPrice(p.price)}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
