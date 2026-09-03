import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Boxes, Clock,
  CreditCard, Download, Package, Printer, RotateCcw, TrendingUp, Truck, Users, Wallet,
} from 'lucide-react';
import PageHeader, { StatCard } from '@/components/panel/PageHeader';
import StatusBadge from '@/components/panel/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportRawToExcel } from '@/lib/exportExcel';
import { cn, formatDate, formatNumber, formatPrice } from '@/lib/utils';

interface Props {
  /** API istemcisi dışarıdan verilir — bileşen hangi panelde olduğunu bilmez. */
  client: AxiosInstance;
  scope?: string;
}

/** Grafiklerde kullanılan marka uyumlu renk dizisi. */
const COLORS = ['#7C3AED', '#A855F7', '#EC4899', '#0EA5E9', '#16A34A', '#EAB308', '#F97316', '#64748B'];

const PRESETS = [
  { days: 7, label: 'Son 7 gün' },
  { days: 30, label: 'Son 30 gün' },
  { days: 90, label: 'Son 90 gün' },
  { days: 365, label: 'Son 1 yıl' },
];

const isoGun = (d: Date) => d.toISOString().slice(0, 10);

/**
 * DETAYLI RAPORLAR.
 *
 * Tüm raporlar yalnız ciroya sayılan (ödenmiş, iptal edilmemiş) siparişleri
 * kullanır. Sekme AÇILDIĞINDA çekilir; satış raporu istisnadır, üstteki
 * özet kartları ondan beslenir.
 */
export default function ReportsScreen({ client }: Props) {
  const [days, setDays] = useState(30);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [tab, setTab] = useState('sales');

  // Elle tarih girildiyse gün ön ayarı yok sayılır; sunucu from/to bekler
  const params = useMemo(() => {
    const query = new URLSearchParams();

    if (dateFrom && dateTo) {
      query.set('from', dateFrom);
      query.set('to', dateTo);
    } else {
      const to = new Date();
      const from = new Date(Date.now() - (days - 1) * 86_400_000);
      query.set('from', isoGun(from));
      query.set('to', isoGun(to));
    }

    return query;
  }, [days, dateFrom, dateTo]);

  const useReport = <T,>(key: string, enabled: boolean, extra = '') =>
    useQuery<T>({
      queryKey: ['report', key, params.toString(), extra],
      queryFn: async () => (await client.get(`/reports/${key}?${params}${extra}`)).data,
      enabled,
      staleTime: 60_000,
    });

  const sales = useReport<SalesReport>('sales', true, `&group_by=${groupBy}`);
  const products = useReport<ProductsReport>('products', tab === 'products');
  const categories = useReport<CategoriesReport>('categories', tab === 'categories');
  const customers = useReport<CustomersReport>('customers', tab === 'customers');
  const stock = useReport<StockReport>('stock', tab === 'stock');
  const operations = useReport<OperationsReport>('operations', tab === 'operations');
  const finance = useReport<FinanceReport>('finance', tab === 'finance');

  const totals = sales.data?.totals;
  const comparison = sales.data?.comparison;
  const rhythm = sales.data?.rhythm;

  const peakDay = useMemo(() => enBuyuk(rhythm?.weekdays ?? []), [rhythm]);
  const peakHour = useMemo(() => {
    const h = enBuyuk(rhythm?.hours ?? []);
    return h ? { ...h, label: `${String(h.hour).padStart(2, '0')}:00` } : null;
  }, [rhythm]);
  const bestPeriod = useMemo(() => enBuyuk(sales.data?.series ?? []), [sales.data]);

  const degisim = (v: number | null | undefined) =>
    v === null || v === undefined ? undefined : `${v >= 0 ? '▲' : '▼'} %${Math.abs(v)} önceki döneme göre`;

  return (
    <div>
      <PageHeader
        title="Raporlar"
        description="Satış, ürün, kategori, müşteri, stok, operasyon ve finans analizleri"
        icon={BarChart3}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => { setDays(preset.days); setDateFrom(''); setDateTo(''); }}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                    !dateFrom && days === preset.days
                      ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36 text-xs" />

            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Yazdır
            </Button>
          </div>
        }
      />

      {/* ── Üst özet ─────────────────────────────────────────────────── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ciro"
          value={sales.isLoading ? '…' : formatPrice(totals?.revenue ?? 0)}
          hint={degisim(comparison?.revenue.change)}
          icon={TrendingUp} tone="brand"
        />
        <StatCard
          label="Sipariş"
          value={sales.isLoading ? '…' : formatNumber(totals?.orders ?? 0)}
          hint={degisim(comparison?.orders.change)}
          icon={Boxes}
        />
        <StatCard
          label="Satılan Adet"
          value={sales.isLoading ? '…' : formatNumber(totals?.units ?? 0)}
          hint={`Kupon indirimi: ${formatPrice(totals?.discount ?? 0)}`}
          icon={Package} tone="success"
        />
        <StatCard
          label="Ortalama Sepet"
          value={sales.isLoading ? '…' : formatPrice(totals?.avg_basket ?? 0)}
          hint={`Kargo geliri: ${formatPrice(totals?.shipping ?? 0)}`}
          icon={Wallet}
        />
      </div>

      {comparison && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <span className="text-muted-foreground">
            Önceki dönem ({formatDate(comparison.previous_range.from)} – {formatDate(comparison.previous_range.to)}):
          </span>
          <strong>{formatPrice(comparison.revenue.previous)}</strong>
          {comparison.revenue.change !== null && (
            <Badge variant={comparison.revenue.change >= 0 ? 'success' : 'destructive'} className="gap-1">
              {comparison.revenue.change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              %{Math.abs(comparison.revenue.change)}
            </Badge>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{formatNumber(comparison.orders.previous)} sipariş</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-2 flex-wrap print:hidden">
          <TabsTrigger value="sales">Satış</TabsTrigger>
          <TabsTrigger value="products">Ürün</TabsTrigger>
          <TabsTrigger value="categories">Kategori</TabsTrigger>
          <TabsTrigger value="customers">Müşteri</TabsTrigger>
          <TabsTrigger value="stock">Stok</TabsTrigger>
          <TabsTrigger value="operations">Operasyon</TabsTrigger>
          <TabsTrigger value="finance">Finans</TabsTrigger>
        </TabsList>

        {/* ══ SATIŞ ══════════════════════════════════════════════════ */}
        <TabsContent value="sales">
          <Panel
            title="Satış Trendi"
            hint="Satış olmayan dönemler sıfır olarak çizilir; boşluklar gerçek duraklamalardır."
            loading={sales.isLoading}
            toolbar={
              <div className="flex rounded-lg border border-border p-0.5">
                {(['day', 'week', 'month'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      groupBy === g ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {g === 'day' ? 'Günlük' : g === 'week' ? 'Haftalık' : 'Aylık'}
                  </button>
                ))}
              </div>
            }
          >
            {(sales.data?.series.length ?? 0) === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={sales.data!.series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={kisaSayi} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={paraBicimi} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="revenue" name="Ciro" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="shipping" name="Kargo" fill="#A855F7" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="orders" name="Sipariş" stroke="#EC4899" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="En İyi Dönem" value={bestPeriod?.label ?? '—'}
              hint={bestPeriod ? `${formatPrice(bestPeriod.revenue)} · ${formatNumber(bestPeriod.orders)} sipariş` : undefined}
              icon={TrendingUp} tone="success" />
            <StatCard label="En Yoğun Gün" value={peakDay?.label ?? '—'}
              hint={peakDay ? formatPrice(peakDay.revenue) : undefined} icon={Clock} tone="brand" />
            <StatCard label="En Yoğun Saat" value={peakHour?.label ?? '—'}
              hint={peakHour ? formatPrice(peakHour.revenue) : undefined} icon={Clock} />
            <StatCard label="Kargo Geliri" value={formatPrice(totals?.shipping ?? 0)} icon={Truck} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Haftanın Günlerine Göre Satış" hint="Kampanya ve kargo çıkış planı bu dağılıma göre yapılır." loading={sales.isLoading}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rhythm?.weekdays ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={kisaSayi} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={paraBicimi} />
                  <Bar dataKey="revenue" name="Ciro" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Günün Saatlerine Göre Satış" hint="Reklam saatleri ve destek vardiyası için." loading={sales.isLoading}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={(rhythm?.hours ?? []).map((h) => ({ ...h, label: `${String(h.hour).padStart(2, '0')}` }))} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval={2} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={kisaSayi} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={paraBicimi} />
                  <Bar dataKey="revenue" name="Ciro" fill="#EC4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <ReportTable
            title="Dönem Detayı"
            loading={sales.isLoading}
            rows={sales.data?.series ?? []}
            exportName="satis-raporu"
            columns={[
              { key: 'label', label: 'Dönem' },
              { key: 'orders', label: 'Sipariş', type: 'number' },
              { key: 'revenue', label: 'Ciro', type: 'money' },
              { key: 'shipping', label: 'Kargo', type: 'money' },
              { key: 'discount', label: 'Kupon İndirimi', type: 'money' },
              { key: 'avg_basket', label: 'Ort. Sepet', type: 'money' },
            ]}
          />
        </TabsContent>

        {/* ══ ÜRÜN ═══════════════════════════════════════════════════ */}
        <TabsContent value="products">
          <ReportTable
            title="En Çok Ciro Getiren Ürünler"
            loading={products.isLoading}
            rows={products.data?.top ?? []}
            exportName="urun-raporu"
            columns={[
              { key: 'name', label: 'Ürün' },
              { key: 'units', label: 'Satılan', type: 'number' },
              { key: 'orders', label: 'Sipariş', type: 'number' },
              { key: 'revenue', label: 'Ciro', type: 'money' },
              { key: 'stock', label: 'Kalan Stok', type: 'number' },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportTable
              title="Kritik Stoktaki Ürünler"
              hint="Eşiğin altına inmiş ürünler — sipariş verilmezse yakında satışa kapanır."
              loading={products.isLoading}
              rows={products.data?.low_stock ?? []}
              exportName="kritik-stok"
              columns={[
                { key: 'name', label: 'Ürün' },
                { key: 'stock', label: 'Stok', type: 'number' },
                { key: 'low_stock_threshold', label: 'Eşik', type: 'number' },
                { key: 'sold_count', label: 'Toplam Satış', type: 'number' },
              ]}
            />

            <ReportTable
              title="Hiç Satmayan Yayındaki Ürünler"
              hint="Sorun fiyatta, görselde ya da açıklamada olabilir."
              loading={products.isLoading}
              rows={(products.data?.never_sold ?? []).map((p) => ({ ...p, since: formatDate(p.created_at) }))}
              exportName="hic-satmayan-urunler"
              columns={[
                { key: 'name', label: 'Ürün' },
                { key: 'price', label: 'Fiyat', type: 'money' },
                { key: 'stock', label: 'Stok', type: 'number' },
                { key: 'since', label: 'Eklenme' },
              ]}
            />
          </div>
        </TabsContent>

        {/* ══ KATEGORİ ═══════════════════════════════════════════════ */}
        <TabsContent value="categories">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Kategori Ciro Dağılımı" loading={categories.isLoading}>
              {(categories.data?.categories.length ?? 0) === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={categories.data!.categories.slice(0, 8)} dataKey="revenue" nameKey="category"
                      cx="50%" cy="50%" outerRadius={110} innerRadius={55} paddingAngle={2}>
                      {categories.data!.categories.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={paraBicimi} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Kategori Karşılaştırma" loading={categories.isLoading}>
              {(categories.data?.categories.length ?? 0) === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categories.data!.categories.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={kisaSayi} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="category" width={120} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={paraBicimi} />
                    <Bar dataKey="revenue" name="Ciro" fill="#7C3AED" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <ReportTable
            title="Kategori Detayı"
            hint="Kümülatif pay %80'i geçtiği satır, cironun büyük kısmını taşıyan kategori kümesinin sınırıdır."
            loading={categories.isLoading}
            rows={categories.data?.categories ?? []}
            exportName="kategori-raporu"
            columns={[
              { key: 'category', label: 'Kategori' },
              { key: 'units', label: 'Satılan', type: 'number' },
              { key: 'orders', label: 'Sipariş', type: 'number' },
              { key: 'revenue', label: 'Ciro', type: 'money' },
              { key: 'share', label: 'Pay %', type: 'percent' },
              { key: 'cumulative_share', label: 'Kümülatif %', type: 'percent' },
            ]}
          />
        </TabsContent>

        {/* ══ MÜŞTERİ ════════════════════════════════════════════════ */}
        <TabsContent value="customers">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Yeni Üyelik" value={formatNumber(customers.data?.registrations ?? 0)} hint="Seçili dönemde kayıt olan" icon={Users} />
            <StatCard label="Üye Siparişi" value={formatNumber(customers.data?.guest_vs_member.member ?? 0)}
              hint={`Misafir: ${formatNumber(customers.data?.guest_vs_member.guest ?? 0)}`} icon={Users} tone="brand" />
            <StatCard label="İlk Sipariş" value={formatNumber(customers.data?.new_vs_returning.new.orders ?? 0)}
              hint={formatPrice(customers.data?.new_vs_returning.new.revenue ?? 0)} icon={TrendingUp} tone="success" />
            <StatCard label="Tekrar Sipariş" value={formatNumber(customers.data?.new_vs_returning.returning.orders ?? 0)}
              hint={formatPrice(customers.data?.new_vs_returning.returning.revenue ?? 0)} icon={RotateCcw} />
          </div>

          {customers.data && (
            <Panel
              title="Ciro Nereden Geliyor"
              hint="Yeni müşteri = bu dönemde ilk ödemeli siparişini veren kişi. Büyüme yalnız yeniden geliyorsa reklama bağımlıdır."
              loading={customers.isLoading}
            >
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Yeni müşteri', value: customers.data.new_vs_returning.new.revenue },
                      { name: 'Geri dönen müşteri', value: customers.data.new_vs_returning.returning.revenue },
                    ]}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}
                  >
                    <Cell fill="#7C3AED" />
                    <Cell fill="#16A34A" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={paraBicimi} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          )}

          <ReportTable
            title="Dönemin En Çok Harcayan Müşterileri"
            hint="Harcama sütunu seçili döneme aittir; yaşam boyu toplam ayrı sütunda."
            loading={customers.isLoading}
            rows={(customers.data?.top ?? []).map((c) => ({ ...c, member_since: c.member_since ? formatDate(c.member_since) : '' }))}
            exportName="musteri-raporu"
            columns={[
              { key: 'name', label: 'Müşteri' },
              { key: 'email', label: 'E-posta' },
              { key: 'orders', label: 'Sipariş', type: 'number' },
              { key: 'revenue', label: 'Dönem Harcaması', type: 'money' },
              { key: 'lifetime_orders', label: 'Toplam Sipariş', type: 'number' },
              { key: 'lifetime_revenue', label: 'Yaşam Boyu', type: 'money' },
              { key: 'member_since', label: 'Üyelik' },
            ]}
          />
        </TabsContent>

        {/* ══ STOK ═══════════════════════════════════════════════════ */}
        <TabsContent value="stock">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Yayındaki Ürün" value={formatNumber(stock.data?.summary.products ?? 0)} icon={Package} />
            <StatCard label="Tükenen" value={formatNumber(stock.data?.summary.out_of_stock ?? 0)} icon={AlertTriangle} tone="danger" />
            <StatCard label="Kritik Seviye" value={formatNumber(stock.data?.summary.low_stock ?? 0)} icon={AlertTriangle} tone="warning" />
            <StatCard label="Stok Değeri" value={formatPrice(stock.data?.summary.stock_value ?? 0)} hint="Maliyet (yoksa satış) fiyatıyla" icon={Boxes} tone="brand" />
          </div>

          <Panel title="Ürün Bazında Stok" hint="Varyantlı ürünlerde varyant stokları ayrı gösterilir." loading={stock.isLoading}>
            {(stock.data?.products.length ?? 0) === 0 ? <Empty /> : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Ürün</th>
                      <th className="px-3 py-2 text-right">Stok</th>
                      <th className="px-3 py-2 text-right">Rezerve</th>
                      <th className="px-3 py-2 text-right">Satılabilir</th>
                      <th className="px-3 py-2 text-right">Eşik</th>
                      <th className="px-3 py-2 text-right">Satış</th>
                      <th className="px-3 py-2 text-left">Varyantlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.data!.products.map((p) => (
                      <tr key={p.id} className={cn('border-b border-border last:border-0', p.is_low && 'bg-warning/5')}>
                        <td className="px-3 py-2">
                          <Link to={`/urunler/${p.id}`} className="flex items-center gap-2 hover:text-brand">
                            <span className="size-8 shrink-0 overflow-hidden rounded bg-muted">{p.image && <img src={p.image} alt="" className="size-full object-contain" />}</span>
                            <span className="line-clamp-1">{p.name}</span>
                            {p.is_low && <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.stock}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.reserved}</td>
                        <td className={cn('px-3 py-2 text-right font-bold tabular-nums', (p.available ?? 1) <= 0 && 'text-destructive')}>{p.available ?? '∞'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.threshold}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.sold_count}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {p.variants.map((v) => (
                              <span key={v.name} className={cn('rounded bg-muted px-1.5 py-0.5 text-[10px]', v.stock === 0 && 'text-destructive', !v.is_active && 'line-through')}>
                                {v.name}: {v.stock}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* ══ OPERASYON ══════════════════════════════════════════════ */}
        <TabsContent value="operations">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Ort. Kargoya Veriş"
              value={operations.data ? `${operations.data.fulfillment.avg_ship_hours} saat` : '—'}
              hint="Ödemeden kargoya kadar geçen süre"
              icon={Truck}
              tone={(operations.data?.fulfillment.avg_ship_hours ?? 0) > 48 ? 'warning' : 'success'}
            />
            <StatCard
              label="Ort. Teslimat"
              value={operations.data ? `${operations.data.fulfillment.avg_deliver_hours} saat` : '—'}
              hint="Kargodan teslime kadar"
              icon={Package}
            />
            <StatCard
              label="Geciken Sipariş"
              value={formatNumber(operations.data?.fulfillment.overdue ?? 0)}
              hint="48 saattir kargoya verilmemiş"
              icon={Clock}
              tone={(operations.data?.fulfillment.overdue ?? 0) > 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Sipariş Durumu Dağılımı" loading={operations.isLoading}>
              {(operations.data?.statuses.length ?? 0) === 0 ? <Empty /> : (
                <ul className="divide-y divide-border">
                  {operations.data!.statuses.map((s) => (
                    <li key={s.status} className="flex items-center justify-between py-2 text-sm">
                      <StatusBadge status={s.status} label={s.label} />
                      <strong className="tabular-nums">{formatNumber(s.total)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Ödeme Durumu" loading={operations.isLoading}>
              {(operations.data?.payments.length ?? 0) === 0 ? <Empty /> : (
                <ul className="divide-y divide-border">
                  {operations.data!.payments.map((p) => (
                    <li key={p.status} className="flex items-center justify-between py-2 text-sm">
                      <StatusBadge status={p.status} />
                      <span className="text-muted-foreground">{formatNumber(p.total)} sipariş</span>
                      <strong className="tabular-nums">{formatPrice(p.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <ReportTable
              title="İade Talepleri"
              loading={operations.isLoading}
              rows={operations.data?.returns ?? []}
              exportName="iade-durumlari"
              columns={[
                { key: 'label', label: 'Durum' },
                { key: 'total', label: 'Adet', type: 'number' },
                { key: 'amount', label: 'Tutar', type: 'money' },
              ]}
            />

            <ReportTable
              title="İade Sebepleri"
              hint="Aynı sebep tekrarlıyorsa ürün açıklaması veya kalite kontrol gözden geçirilmeli."
              loading={operations.isLoading}
              rows={operations.data?.return_reasons ?? []}
              exportName="iade-sebepleri"
              columns={[
                { key: 'reason', label: 'Sebep' },
                { key: 'total', label: 'Adet', type: 'number' },
              ]}
            />
          </div>
        </TabsContent>

        {/* ══ FİNANS ═════════════════════════════════════════════════ */}
        <TabsContent value="finance">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Tahsilat" value={formatPrice(finance.data?.summary.total ?? 0)}
              hint={`${formatNumber(finance.data?.summary.orders ?? 0)} sipariş`} icon={TrendingUp} tone="brand" />
            <StatCard label="İade Edilen" value={formatPrice(finance.data?.summary.refunded ?? 0)} icon={AlertTriangle}
              tone={(finance.data?.summary.refunded ?? 0) > 0 ? 'warning' : 'default'} />
            <StatCard label="Net Tahsilat" value={formatPrice(finance.data?.summary.net ?? 0)} hint="Tahsilat − iadeler" icon={Wallet} tone="success" />
            <StatCard label="Brüt Kâr" value={formatPrice(finance.data?.summary.gross_margin ?? 0)}
              hint={`Maliyet: ${formatPrice(finance.data?.summary.cost ?? 0)} · KDV: ${formatPrice(finance.data?.summary.tax ?? 0)}`} icon={CreditCard} />
          </div>

          <Panel title="Para Nereye Gidiyor" hint="Ürün satışından başlayıp net tahsilata inen basamaklar. Maliyet fiyatı girilmemiş ürünlerde brüt kâr eksik hesaplanır." loading={finance.isLoading}>
            {(finance.data?.waterfall.length ?? 0) === 0 ? <Empty /> : (
              <div className="space-y-2">
                {finance.data!.waterfall.map((step) => {
                  const enBuyukTutar = Math.max(...finance.data!.waterfall.map((x) => Math.abs(x.amount)), 1);
                  const genislik = Math.max(2, (Math.abs(step.amount) / enBuyukTutar) * 100);
                  const vurgulu = step.kind === 'total' || step.kind === 'subtotal';

                  return (
                    <div key={step.label} className={cn('flex items-center gap-3', vurgulu && 'border-t border-border pt-3')}>
                      <span className={cn('w-48 shrink-0 text-sm', vurgulu ? 'font-black' : 'text-muted-foreground')}>{step.label}</span>
                      <div className="h-6 flex-1 overflow-hidden rounded bg-muted/40">
                        <div
                          className={cn('h-full rounded', step.kind === 'out' ? 'bg-destructive/70' : vurgulu ? 'bg-brand' : 'bg-success/70')}
                          style={{ width: `${genislik}%` }}
                        />
                      </div>
                      <span className={cn('w-36 shrink-0 text-right text-sm tabular-nums', vurgulu ? 'font-black' : step.amount < 0 ? 'text-destructive' : '')}>
                        {step.amount < 0 ? '−' : ''}{formatPrice(Math.abs(step.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportTable
              title="Ödeme Sağlayıcısına Göre"
              loading={finance.isLoading}
              rows={finance.data?.by_provider ?? []}
              exportName="odeme-saglayici"
              columns={[
                { key: 'provider', label: 'Sağlayıcı' },
                { key: 'orders', label: 'Sipariş', type: 'number' },
                { key: 'amount', label: 'Tutar', type: 'money' },
              ]}
            />
            <ReportTable
              title="Taksit Dağılımı"
              hint="Peşin fiyatına taksit kampanyalarının kullanım oranı."
              loading={finance.isLoading}
              rows={(finance.data?.installments ?? []).map((i) => ({ ...i, label: i.installment <= 1 ? 'Tek çekim' : `${i.installment} taksit` }))}
              exportName="taksit-dagilimi"
              columns={[
                { key: 'label', label: 'Taksit' },
                { key: 'orders', label: 'Sipariş', type: 'number' },
                { key: 'amount', label: 'Tutar', type: 'money' },
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  fontSize: 12,
};

/** Eksende 1.250.000 yerine "1,3M" — okunabilirlik için. */
function kisaSayi(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}b`;
  return String(v);
}

/** Grafik ipucunda tutarı para, adedi sayı olarak gösterir. */
const paraBicimi = ((deger: number, ad: string) =>
  ad === 'Sipariş' ? formatNumber(deger) : formatPrice(deger)) as never;

/** Ciroya göre en yüksek satırı döndürür (hiç satış yoksa null). */
function enBuyuk<T extends { revenue: number }>(rows: T[]): T | null {
  const best = rows.reduce<T | null>((acc, row) => (row.revenue > (acc?.revenue ?? 0) ? row : acc), null);
  return best && best.revenue > 0 ? best : null;
}

function Panel({
  title, hint, loading, children, onExport, toolbar,
}: {
  title: string; hint?: string; loading?: boolean;
  children: React.ReactNode; onExport?: () => void; toolbar?: React.ReactNode;
}) {
  return (
    <div className="mb-4 break-inside-avoid rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-black">{title}</h2>
          {hint && <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {toolbar}
          {onExport && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
              <Download className="size-3.5" /> Excel
            </Button>
          )}
        </div>
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-lg bg-muted" /> : children}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      Bu dönemde veri yok.
    </div>
  );
}

interface TableColumn {
  key: string;
  label: string;
  type?: 'number' | 'money' | 'percent';
  warnAbove?: number;
}

/**
 * RAPOR TABLOSU — Excel çıktısını kendisi üretir (başlıklar ekrandakiyle
 * aynı) ve sütun başlığından sıralanır.
 */
function ReportTable({
  title, hint, rows, columns, loading, exportName,
}: {
  title: string; hint?: string;
  rows: Array<Record<string, unknown>>;
  columns: TableColumn[];
  loading?: boolean;
  exportName?: string;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);

  const sirali = useMemo(() => {
    if (!sort) return rows;

    const { key, desc } = sort;

    return [...rows].sort((a, b) => {
      const x = a[key];
      const y = b[key];

      if (x === null || x === undefined || x === '') return 1;
      if (y === null || y === undefined || y === '') return -1;

      const fark = typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'tr');

      return desc ? -fark : fark;
    });
  }, [rows, sort]);

  const disaAktar = () => {
    const veri = sirali.map((row) => {
      const satir: Record<string, unknown> = {};
      columns.forEach((column) => { satir[column.label] = row[column.key] ?? ''; });
      return satir;
    });

    exportRawToExcel(veri, `${exportName ?? 'rapor'}.xlsx`, title.slice(0, 31));
  };

  return (
    <Panel title={title} hint={hint} loading={loading} onExport={rows.length > 0 ? disaAktar : undefined}>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Bu dönemde veri yok.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => setSort((prev) =>
                      prev?.key === column.key ? { key: column.key, desc: !prev.desc } : { key: column.key, desc: true })}
                    className={cn(
                      'cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground',
                      column.type ? 'text-right' : 'text-left',
                    )}
                  >
                    {column.label}
                    {sort?.key === column.key && <span className="ml-1 text-brand">{sort.desc ? '▼' : '▲'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sirali.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                  {columns.map((column) => {
                    const value = row[column.key];
                    const uyari = column.warnAbove !== undefined && typeof value === 'number' && value > column.warnAbove;

                    return (
                      <td key={column.key} className={cn('px-3 py-2', column.type ? 'text-right tabular-nums' : '', uyari && 'font-bold text-destructive')}>
                        {value === null || value === undefined || value === ''
                          ? '—'
                          : column.type === 'money' ? formatPrice(Number(value))
                            : column.type === 'percent' ? `%${value}`
                              : column.type === 'number' ? formatNumber(Number(value))
                                : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ── Rapor yanıt tipleri (ReportController ile birebir) ─────────────── */

interface Period {
  period: string; label: string; orders: number; revenue: number;
  shipping: number; discount: number; avg_basket: number;
  [k: string]: unknown;
}

interface SalesReport {
  range: { from: string; to: string; group_by: string };
  series: Period[];
  totals: { orders: number; revenue: number; shipping: number; discount: number; units: number; avg_basket: number };
  comparison: {
    previous_range: { from: string; to: string };
    revenue: { current: number; previous: number; change: number | null };
    orders: { current: number; previous: number; change: number | null };
  };
  rhythm: {
    weekdays: Array<{ label: string; orders: number; revenue: number }>;
    hours: Array<{ hour: number; orders: number; revenue: number }>;
  };
}
interface ProductsReport {
  top: Array<Record<string, unknown>>;
  never_sold: Array<{ id: number; name: string; price: number; stock: number; created_at: string; [k: string]: unknown }>;
  low_stock: Array<Record<string, unknown>>;
}
interface CategoriesReport {
  categories: Array<{ category: string; revenue: number; [k: string]: unknown }>;
  total: number;
}
interface CustomersReport {
  top: Array<{ member_since: string | null; [k: string]: unknown }>;
  new_vs_returning: { new: { orders: number; revenue: number }; returning: { orders: number; revenue: number } };
  guest_vs_member: { guest: number; member: number };
  registrations: number;
}
interface StockReport {
  summary: { products: number; out_of_stock: number; low_stock: number; stock_value: number };
  products: Array<{
    id: number; name: string; image: string | null; stock: number; reserved: number; available: number | null;
    threshold: number; is_low: boolean; sold_count: number;
    variants: Array<{ name: string; stock: number; is_active: boolean }>;
  }>;
}
interface OperationsReport {
  payments: Array<{ status: string; total: number; amount: number }>;
  statuses: Array<{ status: string; label: string; total: number }>;
  returns: Array<Record<string, unknown>>;
  return_reasons: Array<Record<string, unknown>>;
  fulfillment: { avg_ship_hours: number; avg_deliver_hours: number; overdue: number };
}
interface FinanceReport {
  summary: {
    orders: number; gross: number; shipping: number; discount: number; tax: number;
    total: number; refunded: number; net: number; cost: number; gross_margin: number;
  };
  waterfall: Array<{ label: string; amount: number; kind: 'in' | 'out' | 'subtotal' | 'total' }>;
  by_provider: Array<Record<string, unknown>>;
  installments: Array<{ installment: number; orders: number; amount: number }>;
}
