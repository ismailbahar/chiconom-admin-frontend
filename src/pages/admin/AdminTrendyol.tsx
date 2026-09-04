import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle, Check, CloudDownload, ExternalLink, Link2, Loader2, Plug, RefreshCw, Search, ShoppingBasket,
  Store, Unlink, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader, { StatCard } from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SmartImage from '@/components/SmartImage';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatDateTime, formatNumber, formatPrice } from '@/lib/utils';

interface Status {
  enabled: boolean;
  configured: boolean;
  seller_id: string | null;
  base_url: string;
  last_sync_at: string | null;
  last_price_update_at: string | null;
  last_push_at: string | null;
  last_sync_summary: { fetched: number; created: number; updated: number; matched: number } | null;
  counts: {
    total: number; matched: number; unmatched: number; on_sale: number;
    products_with_price: number; products_total: number;
  };
}

interface Row {
  id: number;
  barcode: string;
  stock_code: string | null;
  title: string;
  brand: string | null;
  category: string | null;
  color: string | null;
  image: string | null;
  product_url: string | null;
  content_id: number | null;
  sale_price: number | null;
  list_price: number | null;
  quantity: number | null;
  on_sale: boolean;
  archived: boolean;
  match_type: string | null;
  match_label: string | null;
  product_id: number | null;
  product_name: string | null;
  product_price: number | null;
  product_stock: number | null;
  product_trendyol_price: number | null;
  variant_id: number | null;
  variant_name: string | null;
  pushed_at: string | null;
  synced_at: string | null;
  [key: string]: unknown;
}

interface CatalogProduct {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cover_image: string | null;
  variants: Array<{ id: number; name: string | null; sku: string | null; barcode: string | null }>;
}

interface TyOrder {
  id: number | null;
  order_number: string | null;
  status: string | null;
  customer: string;
  city: string | null;
  total: number | null;
  cargo: string | null;
  tracking: string | null;
  order_date: string | null;
  lines: Array<{ barcode: string | null; name: string; quantity: number; price: number | null }>;
}

const MATCH_TABS = [
  { value: '', label: 'Tümü' },
  { value: 'matched', label: 'Eşlenen' },
  { value: 'unmatched', label: 'Eşlenmemiş' },
];

const TY_STATUS: Record<string, string> = {
  Created: 'Yeni', Picking: 'Hazırlanıyor', Invoiced: 'Faturalandı', Shipped: 'Kargoda', Delivered: 'Teslim',
  Cancelled: 'İptal', Returned: 'İade', UnDelivered: 'Teslim edilemedi', UnSupplied: 'Tedarik edilemedi', AtCollectionPoint: 'Teslim noktasında',
};

/**
 * TRENDYOL EKRANI.
 *
 * Trendyol'daki ilanlar buradan çekilir, katalogdaki ürünlerle eşlenir ve
 * "Tüm Fiyatları Güncelle" ile Trendyol satış fiyatları ürünlere yazılır
 * (vitrindeki "Trendyol'dan satın al" düğmesi). İstenirse mağazadaki fiyat ve
 * stok Trendyol'a gönderilir; son siparişler salt okunur listelenir.
 */
export default function AdminTrendyol() {
  const qc = useQueryClient();
  const [match, setMatch] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [matchRow, setMatchRow] = useState<Row | null>(null);
  const [pushAllOpen, setPushAllOpen] = useState(false);

  useEffect(() => {
    document.title = 'Trendyol — Chiconom Yönetim';
  }, []);

  const { data: status, isLoading: statusLoading } = useQuery<{ data: Status }>({
    queryKey: ['trendyol-status'],
    queryFn: async () => (await adminApi.get('/trendyol/status')).data,
  });

  const st = status?.data;

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      id: 'select',
      header: () => <span className="sr-only">Seç</span>,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selected.includes(row.original.id)}
          onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, row.original.id] : prev.filter((id) => id !== row.original.id)))}
          className="rounded border-input accent-brand"
        />
      ),
      meta: { skipExport: true, disableFilter: true, width: 40, align: 'center' },
      enableSorting: false,
    },
    {
      accessorKey: 'title',
      header: 'Trendyol İlanı',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
            <SmartImage src={row.original.image} alt={row.original.title} imgClassName="object-contain p-1" />
          </div>
          <div className="min-w-0">
            {row.original.product_url ? (
              <a href={row.original.product_url} target="_blank" rel="noreferrer" className="line-clamp-1 text-sm font-medium hover:text-brand hover:underline">
                {row.original.title}
              </a>
            ) : (
              <p className="line-clamp-1 text-sm font-medium">{row.original.title}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {[row.original.brand, row.original.color, row.original.category].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
      ),
      meta: { exportHeader: 'İlan', filterPlaceholder: 'İlan adı…' },
    },
    {
      accessorKey: 'barcode',
      header: 'Barkod',
      cell: ({ row }) => (
        <div className="font-mono text-xs">
          <p>{row.original.barcode}</p>
          {row.original.stock_code && <p className="text-muted-foreground">{row.original.stock_code}</p>}
        </div>
      ),
      meta: { exportHeader: 'Barkod', filterPlaceholder: 'Barkod…' },
    },
    {
      accessorKey: 'sale_price',
      header: 'Trendyol Fiyatı',
      cell: ({ row }) => (
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-[#F27A1A]">{row.original.sale_price != null ? formatPrice(row.original.sale_price) : '—'}</p>
          {row.original.list_price != null && row.original.list_price > (row.original.sale_price ?? 0) && (
            <p className="text-[10px] text-muted-foreground line-through">{formatPrice(row.original.list_price)}</p>
          )}
        </div>
      ),
      meta: { exportHeader: 'Trendyol Fiyatı', exportFormat: 'currency', align: 'right', filterPlaceholder: 'Fiyat…' },
    },
    {
      accessorKey: 'quantity',
      header: 'TY Stok',
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.quantity ?? '—'}</span>,
      meta: { exportHeader: 'Trendyol Stok', exportFormat: 'number', align: 'right', filterPlaceholder: 'Stok…' },
    },
    {
      accessorKey: 'on_sale',
      header: 'Satışta',
      cell: ({ row }) => (
        row.original.archived
          ? <Badge variant="secondary">Arşiv</Badge>
          : row.original.on_sale
            ? <Badge variant="success" className="gap-1"><Check className="size-3" /> Evet</Badge>
            : <Badge variant="warning">Hayır</Badge>
      ),
      meta: {
        exportHeader: 'Satışta', exportFormat: 'boolean',
        filterVariant: 'select', filterOptions: [{ value: '1', label: 'Evet' }, { value: '0', label: 'Hayır' }],
      },
    },
    {
      accessorKey: 'product_name',
      header: 'Mağaza Ürünü',
      cell: ({ row }) => {
        const r = row.original;

        if (!r.product_id) {
          return <span className="text-xs text-warning">Eşlenmemiş</span>;
        }

        return (
          <div className="min-w-0 text-xs">
            <Link to={`/urunler/${r.product_id}`} className="line-clamp-1 font-medium hover:text-brand hover:underline">
              {r.product_name}{r.variant_name ? ` — ${r.variant_name}` : ''}
            </Link>
            <p className="text-muted-foreground">
              Mağaza {r.product_price != null ? formatPrice(r.product_price) : '—'} · stok {r.product_stock ?? '—'}
              {r.product_trendyol_price != null && <> · TY fiyatı <span className="font-semibold text-[#F27A1A]">{formatPrice(r.product_trendyol_price)}</span></>}
            </p>
            <p className="text-[10px] text-muted-foreground">Eşleme: {r.match_label}</p>
          </div>
        );
      },
      meta: { exportHeader: 'Mağaza Ürünü', filterPlaceholder: 'Ürün…' },
      enableSorting: false,
    },
    {
      accessorKey: 'pushed_at',
      header: 'Son Gönderim',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {row.original.pushed_at ? formatDateTime(row.original.pushed_at) : '—'}
        </span>
      ),
      meta: { exportHeader: 'Trendyol\'a Gönderim', exportFormat: 'datetime', disableFilter: true },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMatchRow(row.original)}>
            <Link2 className="size-3.5" /> {row.original.product_id ? 'Değiştir' : 'Eşle'}
          </Button>
          {row.original.product_id && (
            <Button
              variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" title="Eşlemeyi kaldır"
              onClick={async () => {
                try {
                  await adminApi.delete(`/trendyol/products/${row.original.id}/match`);
                  toast.success('Eşleme kaldırıldı.');
                  table.refresh();
                  qc.invalidateQueries({ queryKey: ['trendyol-status'] });
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <Unlink className="size-4" />
            </Button>
          )}
        </div>
      ),
      meta: { skipExport: true, disableFilter: true, align: 'right' },
      enableSorting: false,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selected]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/trendyol/products',
    columns,
    initialSorting: [{ id: 'title', desc: false }],
    extraParams: { match, q: search },
    exportFilename: 'trendyol-ilanlari',
  });

  const afterAction = () => {
    table.refresh();
    qc.invalidateQueries({ queryKey: ['trendyol-status'] });
  };

  const sync = useMutation({
    mutationFn: async () => (await adminApi.post('/trendyol/sync')).data,
    onSuccess: (res) => { toast.success(res.message); afterAction(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const updatePrices = useMutation({
    mutationFn: async () => (await adminApi.post('/trendyol/update-prices')).data,
    onSuccess: (res) => { toast.success(res.message); afterAction(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const push = useMutation({
    mutationFn: async (ids?: number[]) => (await adminApi.post('/trendyol/push', ids ? { ids } : {})).data,
    onSuccess: (res) => { toast.success(res.message); setSelected([]); afterAction(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const busy = sync.isPending || updatePrices.isPending || push.isPending;

  return (
    <div>
      <PageHeader
        title="Trendyol"
        description="Trendyol mağazanızdaki ilanlar, katalog eşlemesi ve Trendyol fiyatları. Fiyatlar buradan ürünlere yazılır ve vitrindeki 'Trendyol'dan satın al' düğmesinde görünür."
        icon={Store}
        actions={
          <>
            {selected.length > 0 && (
              <>
                <Badge variant="soft">{selected.length} seçili</Badge>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => push.mutate(selected)}>
                  <Upload className="size-4" /> Seçilenlerin Fiyat/Stoğunu Gönder
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Temizle</Button>
              </>
            )}
            <Button variant="outline" size="sm" disabled={busy || !st?.configured} onClick={() => sync.mutate()}>
              {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
              İlanları Trendyol'dan Çek
            </Button>
            <Button variant="deal" size="sm" disabled={busy || !st?.configured} onClick={() => updatePrices.mutate()}>
              {updatePrices.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Tüm Fiyatları Güncelle
            </Button>
            <Button variant="outline" size="sm" disabled={busy || !st?.configured} onClick={() => setPushAllOpen(true)}>
              <Upload className="size-4" /> Fiyat/Stok Gönder
            </Button>
          </>
        }
      />

      {/* Bağlantı uyarısı */}
      {!statusLoading && st && !st.configured && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Trendyol API bilgileri girilmemiş.</p>
            <p className="text-xs text-muted-foreground">
              Satıcı No, API Key ve API Secret'ı Trendyol Satıcı Paneli → Hesap Bilgilerim → Entegrasyon Bilgileri'nden alıp{' '}
              <Link to="/ayarlar/entegrasyonlar" className="font-semibold text-brand hover:underline">Entegrasyonlar</Link> ekranına girin.
            </p>
          </div>
        </div>
      )}

      {/* Özet kartları */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Bağlantı"
          value={st?.configured ? (st.enabled ? 'Bağlı · otomatik' : 'Bağlı · elle') : 'Kurulmadı'}
          hint={st?.seller_id ? `Satıcı ${st.seller_id}` : 'Entegrasyonlar ekranından kurun'}
          icon={Plug}
          tone={st?.configured ? 'success' : 'warning'}
        />
        <StatCard label="İlan" value={formatNumber(st?.counts.total ?? 0)} hint={`${formatNumber(st?.counts.on_sale ?? 0)} satışta`} icon={ShoppingBasket} />
        <StatCard label="Eşlenen" value={formatNumber(st?.counts.matched ?? 0)} hint={`${formatNumber(st?.counts.unmatched ?? 0)} eşlenmemiş`} icon={Link2} tone={(st?.counts.unmatched ?? 0) > 0 ? 'warning' : 'success'} />
        <StatCard
          label="Trendyol fiyatlı ürün"
          value={`${formatNumber(st?.counts.products_with_price ?? 0)} / ${formatNumber(st?.counts.products_total ?? 0)}`}
          hint={st?.last_price_update_at ? `Son güncelleme ${formatDateTime(st.last_price_update_at)}` : 'Henüz güncellenmedi'}
          icon={RefreshCw}
          tone="brand"
        />
        <StatCard
          label="Son eşitleme"
          value={st?.last_sync_at ? formatDateTime(st.last_sync_at) : '—'}
          hint={st?.last_sync_summary ? `${st.last_sync_summary.fetched} ilan, ${st.last_sync_summary.matched} eşlendi` : (st?.enabled ? '6 saatte bir otomatik' : 'Elle çalıştırılır')}
          icon={CloudDownload}
        />
      </div>

      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">İlanlar</TabsTrigger>
          <TabsTrigger value="orders">Trendyol Siparişleri</TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          <ServerTable
            {...table.tableProps}
            columns={columns}
            emptyText={st?.counts.total ? 'Süzgece uyan ilan yok.' : "Henüz ilan çekilmedi. 'İlanları Trendyol'dan Çek' ile başlayın."}
            toolbar={
              <>
                <div className="flex rounded-lg border border-border bg-card p-0.5">
                  {MATCH_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => { setMatch(tab.value); setSelected([]); }}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        match === tab.value ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İlan, barkod veya stok kodu…" className="h-8 w-60 text-xs" />
              </>
            }
          />
        </TabsContent>

        <TabsContent value="orders">
          <TrendyolOrders enabled={Boolean(st?.configured)} />
        </TabsContent>
      </Tabs>

      <MatchDialog
        row={matchRow}
        onClose={() => setMatchRow(null)}
        onMatched={() => { setMatchRow(null); afterAction(); }}
      />

      <ConfirmDialog
        open={pushAllOpen}
        onOpenChange={setPushAllOpen}
        title="Fiyat ve stoğu Trendyol'a gönder"
        description="Eşlenmiş TÜM ilanların satış fiyatı, liste fiyatı ve stoğu mağazadaki değerlerle Trendyol'a yazılır. Trendyol aynı isteği 15 dakika içinde tekrar kabul etmez. Devam edilsin mi?"
        confirmLabel="Gönder"
        onConfirm={async () => { await push.mutateAsync(undefined); }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

/** İlanı katalogdaki ürün/varyantla elle eşleme. */
function MatchDialog({ row, onClose, onMatched }: { row: Row | null; onClose: () => void; onMatched: () => void }) {
  const [q, setQ] = useState('');
  const [productId, setProductId] = useState<number | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      setQ(row.stock_code ?? row.barcode ?? '');
      setProductId(row.product_id);
      setVariantId(row.variant_id);
    }
  }, [row]);

  const { data, isFetching } = useQuery<{ data: CatalogProduct[] }>({
    queryKey: ['trendyol-catalog', q],
    queryFn: async () => (await adminApi.get('/trendyol/catalog', { params: { q } })).data,
    enabled: Boolean(row),
  });

  const products = data?.data ?? [];
  const current = products.find((p) => p.id === productId);

  const save = async () => {
    if (!row || !productId) return;
    setSaving(true);

    try {
      const { data: res } = await adminApi.post(`/trendyol/products/${row.id}/match`, {
        product_id: productId,
        product_variant_id: variantId,
      });
      toast.success(res.message);
      onMatched();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>İlanı ürünle eşle</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {row?.title} · <span className="font-mono">{row?.barcode}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün adı, SKU veya barkod…" className="pl-8" autoFocus />
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
          {isFetching && products.length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto size-4 animate-spin" /></p>
          )}
          {!isFetching && products.length === 0 && (
            <p className="p-3 text-center text-xs text-muted-foreground">Ürün bulunamadı.</p>
          )}
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setProductId(p.id); setVariantId(null); }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-muted',
                productId === p.id && 'bg-brand/10 ring-1 ring-brand',
              )}
            >
              <div className="size-9 shrink-0 overflow-hidden rounded bg-secondary/40">
                <SmartImage src={p.cover_image} alt={p.name} imgClassName="object-contain p-0.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-medium">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{[p.sku, p.barcode].filter(Boolean).join(' · ') || '—'} · {formatPrice(p.price)}</p>
              </div>
              {productId === p.id && <Check className="size-4 text-brand" />}
            </button>
          ))}
        </div>

        {current && current.variants.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold">Varyant (renk)</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setVariantId(null)}
                className={cn('rounded-md border px-2.5 py-1 text-xs', variantId === null ? 'border-brand bg-brand/10 text-brand' : 'border-border')}
              >
                Ürün geneli
              </button>
              {current.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={cn('rounded-md border px-2.5 py-1 text-xs', variantId === v.id ? 'border-brand bg-brand/10 text-brand' : 'border-border')}
                  title={[v.sku, v.barcode].filter(Boolean).join(' · ')}
                >
                  {v.name ?? `#${v.id}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}><X className="size-4" /> Vazgeç</Button>
          <Button disabled={!productId || saving} onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Eşle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

/** Son 14 günün Trendyol sipariş paketleri — salt okunur. */
function TrendyolOrders({ enabled }: { enabled: boolean }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ data: TyOrder[]; has_more: boolean }>({
    queryKey: ['trendyol-orders'],
    queryFn: async () => (await adminApi.get('/trendyol/orders', { params: { days: 14 } })).data,
    enabled,
    retry: false,
  });

  if (!enabled) {
    return <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Trendyol bağlantısı kurulunca siparişler burada listelenir.</p>;
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-semibold text-destructive">Siparişler alınamadı</p>
        <p className="text-xs text-muted-foreground">{errorMessage(error)}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}><RefreshCw className="size-3.5" /> Tekrar dene</Button>
      </div>
    );
  }

  const orders = data?.data ?? [];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-xs text-muted-foreground">Son 14 gün · {orders.length} paket{data?.has_more ? ' (devamı Trendyol panelinde)' : ''}</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Yenile
        </Button>
      </div>

      {orders.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Bu aralıkta Trendyol siparişi yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Sipariş</th>
                <th className="px-4 py-2">Müşteri</th>
                <th className="px-4 py-2">Ürünler</th>
                <th className="px-4 py-2 text-right">Tutar</th>
                <th className="px-4 py-2">Durum</th>
                <th className="px-4 py-2">Kargo</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={String(o.id ?? o.order_number)} className="border-t border-border">
                  <td className="px-4 py-2 align-top">
                    <p className="font-mono text-xs font-bold">{o.order_number}</p>
                    <p className="text-[11px] text-muted-foreground">{o.order_date ? formatDateTime(o.order_date) : ''}</p>
                  </td>
                  <td className="px-4 py-2 align-top text-xs">{o.customer}<br /><span className="text-muted-foreground">{o.city}</span></td>
                  <td className="px-4 py-2 align-top text-xs">
                    {o.lines.map((l, i) => <p key={i}>{l.quantity}× {l.name}</p>)}
                  </td>
                  <td className="px-4 py-2 text-right align-top font-medium tabular-nums">{o.total != null ? formatPrice(o.total) : '—'}</td>
                  <td className="px-4 py-2 align-top"><Badge variant="soft">{TY_STATUS[o.status ?? ''] ?? o.status ?? '—'}</Badge></td>
                  <td className="px-4 py-2 align-top text-xs">
                    {o.cargo ?? '—'}{o.tracking ? <><br /><span className="font-mono">{o.tracking}</span></> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Trendyol siparişleri Trendyol'un kendi panelinde yönetilir; burada yalnız izlenir.{' '}
        <a href="https://partner.trendyol.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
          Satıcı paneli <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  );
}
