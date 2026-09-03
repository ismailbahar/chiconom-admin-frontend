import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowRight, ClipboardCheck, LayoutDashboard, MessageCircleQuestion, MessageSquare,
  Package, Receipt, RotateCcw, ShoppingBag, Ticket, TrendingUp, Users, Zap,
} from 'lucide-react';
import PageHeader, { StatCard } from '@/components/panel/PageHeader';
import StatusBadge from '@/components/panel/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/api';
import { cn, formatDateTime, formatNumber, formatPrice } from '@/lib/utils';

interface Dashboard {
  stats: Record<string, number>;
  pending: Record<string, number>;
  pipeline: Array<{ status: string; label: string; total: number }>;
  chart: Array<{ date: string; orders: number; revenue: number }>;
  top_products: Array<{ id: number; name: string; slug: string; cover_image: string | null; price: number; sold_count: number }>;
  recent_orders: Array<{ order_number: string; customer_name: string; grand_total: number; status: string; status_label: string; created_at: string }>;
}

const RANGES = [
  { value: 7, label: '7 gün' },
  { value: 30, label: '30 gün' },
  { value: 90, label: '90 gün' },
  { value: 365, label: '1 yıl' },
];

export default function AdminDashboard() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['admin-dashboard', days],
    queryFn: async () => (await adminApi.get(`/dashboard?days=${days}`)).data,
  });

  useEffect(() => {
    document.title = 'Kontrol Paneli — Chiconom Yönetim';
  }, []);

  const stats = data?.stats ?? {};
  const pending = data?.pending ?? {};

  /** Aksiyon bekleyen işler — tıklanınca ilgili ekrana götürür. */
  const actionItems = [
    { key: 'orders_paid', label: 'Hazırlanacak sipariş', href: '/siparisler/durum/paid', icon: ShoppingBag },
    { key: 'orders_pending_payment', label: 'Ödeme bekleyen', href: '/siparisler/durum/pending', icon: ShoppingBag },
    { key: 'invoices_missing', label: 'Faturası eksik sipariş', href: '/siparisler/durum/shipped', icon: Receipt },
    { key: 'cancellations', label: 'İptal talebi', href: '/iptaller', icon: RotateCcw },
    { key: 'returns_open', label: 'Açık iade', href: '/iadeler', icon: RotateCcw },
    { key: 'reviews', label: 'Bekleyen değerlendirme', href: '/yorumlar', icon: MessageSquare },
    { key: 'questions', label: 'Cevapsız soru', href: '/sorular', icon: MessageCircleQuestion },
    { key: 'support_open', label: 'Açık destek talebi', href: '/destek', icon: Ticket },
    { key: 'low_stock', label: 'Kritik stok', href: '/urunler?low_stock=1', icon: Package },
  ].filter((item) => (pending[item.key] ?? 0) > 0);

  return (
    <div>
      <PageHeader
        title="Kontrol Paneli"
        description="Mağazanın genel durumu ve aksiyon bekleyen işler"
        icon={LayoutDashboard}
        actions={
          <div className="flex rounded-lg border border-border bg-card p-0.5">
            {RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setDays(range.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === range.value ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        }
      />

      {/* ── Aksiyon bekleyenler ─────────────────────────────────────── */}
      {actionItems.length > 0 && (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold">
            <ClipboardCheck className="size-4 text-warning" />
            Aksiyon bekleyen {actionItems.length} konu var
          </p>
          <div className="flex flex-wrap gap-2">
            {actionItems.map((item) => (
              <Button key={item.key} variant="outline" size="sm" className="gap-1.5 bg-card" asChild>
                <Link to={item.href}>
                  <item.icon className="size-3.5" />
                  {item.label}
                  <Badge variant="deal" className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                    {pending[item.key]}
                  </Badge>
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ── Sipariş akışı şeridi ────────────────────────────────────── */}
      {data && (
        <Link
          to="/siparis-panosu"
          className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-brand/40"
        >
          {data.pipeline.map((step, i) => (
            <span key={step.status} className="flex items-center gap-2">
              <span className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
                step.total > 0 ? 'bg-brand-soft font-semibold text-brand' : 'bg-muted text-muted-foreground',
              )}>
                {step.label} <Badge variant={step.total > 0 ? 'deal' : 'secondary'} className="h-4 min-w-4 px-1 text-[10px]">{step.total}</Badge>
              </span>
              {i < data.pipeline.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground/50" />}
            </span>
          ))}
          <span className="ml-auto text-xs font-semibold text-brand">Panoyu aç →</span>
        </Link>
      )}

      {/* ── Özet kartlar ────────────────────────────────────────────── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Ciro (${days} gün)`}
          value={isLoading ? '…' : formatPrice(stats.revenue_period ?? 0)}
          hint={`Toplam: ${formatPrice(stats.revenue_total ?? 0)}`}
          icon={TrendingUp}
          tone="brand"
        />
        <StatCard
          label={`Sipariş (${days} gün)`}
          value={isLoading ? '…' : formatNumber(stats.orders_period ?? 0)}
          hint={`Ortalama sepet: ${formatPrice(stats.avg_basket ?? 0)}`}
          icon={ShoppingBag}
        />
        <StatCard
          label={`Yeni Müşteri (${days} gün)`}
          value={isLoading ? '…' : formatNumber(stats.customers_period ?? 0)}
          hint={`Toplam: ${formatNumber(stats.customers ?? 0)}`}
          icon={Users}
          tone="success"
        />
        <StatCard
          label="Yayındaki Ürün"
          value={isLoading ? '…' : formatNumber(stats.products_live ?? 0)}
          hint={`${formatNumber(stats.campaigns_live ?? 0)} aktif kampanya`}
          icon={Package}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Ciro grafiği ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-black">Günlük Ciro</h2>

          {isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : (data?.chart.length ?? 0) === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Bu dönemde satış yok.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={data!.chart} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date" tickLine={false} axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                />
                <YAxis
                  tickLine={false} axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}b` : String(v))}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12, border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))', fontSize: 12,
                  }}
                  labelFormatter={((v: string) => new Date(v).toLocaleDateString('tr-TR', { dateStyle: 'long' })) as never}
                  formatter={((value: number, name: string) => [
                    name === 'revenue' ? formatPrice(value) : formatNumber(value),
                    name === 'revenue' ? 'Ciro' : 'Sipariş',
                  ]) as never}
                />
                <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2} fill="url(#revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Son siparişler ────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black">Son Siparişler</h2>
            <Link to="/siparisler" className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              Tümü <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {(data?.recent_orders ?? []).slice(0, 8).map((order) => (
              <Link
                key={order.order_number}
                to={`/siparisler/${order.order_number}`}
                className="flex items-center gap-2 rounded-lg border border-border p-2.5 transition-colors hover:border-brand/40 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-bold">{order.order_number}</p>
                  <p className="truncate text-xs text-muted-foreground">{order.customer_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-brand">{formatPrice(order.grand_total)}</p>
                  <StatusBadge status={order.status} label={order.status_label} className="mt-0.5 text-[9px]" />
                </div>
              </Link>
            ))}

            {!isLoading && (data?.recent_orders.length ?? 0) === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Henüz sipariş yok.</p>
            )}
          </div>
        </div>

        {/* ── En çok satan ürünler ──────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Zap className="size-4 text-brand" /> En Çok Satan Ürünler
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(data?.top_products ?? []).map((product) => (
              <Link key={product.id} to={`/urunler/${product.id}`} className="flex items-center gap-2.5 rounded-lg border border-border p-2 hover:border-brand/40">
                <div className="size-10 shrink-0 overflow-hidden rounded bg-secondary/40">
                  {product.cover_image && (
                    <img src={product.cover_image} alt="" className="size-full object-contain p-0.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-medium">{product.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatNumber(product.sold_count)} satıldı</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-brand">{formatPrice(product.price)}</span>
              </Link>
            ))}
            {!isLoading && (data?.top_products.length ?? 0) === 0 && (
              <p className="col-span-full py-4 text-center text-sm text-muted-foreground">Henüz satış verisi yok.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Alt özet ────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam Müşteri" value={formatNumber(stats.customers ?? 0)} icon={Users} />
        <StatCard label="Toplam Sipariş" value={formatNumber(stats.orders_total ?? 0)} icon={ShoppingBag} />
        <StatCard label="Kargodaki Sipariş" value={formatNumber(pending.orders_shipped ?? 0)} icon={Package} tone="brand" />
        <StatCard label="Toplam Ciro" value={formatPrice(stats.revenue_total ?? 0)} icon={TrendingUp} tone="success" />
      </div>

      {data?.recent_orders?.[0] && (
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Son sipariş: {formatDateTime(data.recent_orders[0].created_at)}
        </p>
      )}
    </div>
  );
}
