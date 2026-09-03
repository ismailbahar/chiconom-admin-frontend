import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRight, Loader2, Receipt, ShoppingBag, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import StatusBadge, { ORDER_CLOSED, ORDER_FLOW, ORDER_STATUS_LABELS, statusOptions } from '@/components/panel/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { usePanelAuthStore } from '@/stores/panelAuthStore';
import { cn, formatPrice, formatNumber, formatDateTime } from '@/lib/utils';

interface Row {
  id: number;
  order_number: string;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  items_count: number;
  subtotal: number;
  shipping_total: number;
  grand_total: number;
  status: string;
  status_label?: string;
  payment_status: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  has_invoice: boolean;
  invoice_number: string | null;
  created_at: string;
  paid_at: string | null;
  has_note?: boolean;
  next_statuses: string[];
  [key: string]: unknown;
}

/** Sekmeler: akış sırası + kapananlar. "closed" sunucuda özel süzgeçtir. */
const TABS = [
  { value: '', label: 'Tümü' },
  { value: 'open', label: 'Açık İşler' },
  ...ORDER_FLOW.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
  { value: 'closed', label: 'İptal & İade' },
];

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  pending:    { title: 'Ödeme Bekleyen Siparişler', description: 'Ödemesi henüz tamamlanmamış siparişler. Havale/EFT ile ödeyenleri "Ödendi" işaretleyin.' },
  paid:       { title: 'Hazırlanacak Siparişler', description: 'Ödemesi alınmış, paketlenmeyi bekleyen siparişler. Hazırlamaya başladığınızda ilerletin.' },
  processing: { title: 'Hazırlanan Siparişler', description: 'Paketlenen siparişler. Kargoya verildiğinde takip numarasıyla ilerletin.' },
  shipped:    { title: 'Kargodaki Siparişler', description: 'Kargoya verilmiş, teslim bekleyen siparişler. Teslimat takipten otomatik işlenir.' },
  delivered:  { title: 'Teslim Edilen Siparişler', description: 'Teslim edilmiş siparişler. İade süresi dolunca otomatik tamamlanır.' },
  completed:  { title: 'Tamamlanan Siparişler', description: 'Kapanmış ve iade süresi dolmuş siparişler.' },
  closed:     { title: 'İptal ve İade Edilen Siparişler', description: 'İptal edilen, iade edilen ve ödemesi başarısız siparişler.' },
};

const PAYMENT_METHODS = [
  { value: 'card', label: 'Kredi Kartı' },
  { value: 'bank_transfer', label: 'Havale/EFT' },
  { value: 'manual', label: 'Manuel' },
];

/**
 * Sipariş listesi.
 *
 * Aynı ekran iki şekilde kullanılır:
 *   /siparisler                → sekmelerle süzülen genel liste
 *   /siparisler/durum/:status  → tek duruma odaklı sayfa (menüden)
 *
 * Her sütun sunucuda süzülür ve sıralanır; satırdaki ok düğmesi siparişi
 * bir sonraki adıma geçirir (detaya girmeden).
 */
export default function AdminOrders() {
  const navigate = useNavigate();
  const { status: routeStatus } = useParams();
  const can = usePanelAuthStore((s) => s.can);

  const [status, setStatus] = useState(routeStatus ?? '');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setStatus(routeStatus ?? '');
  }, [routeStatus]);

  const page = routeStatus ? PAGE_TITLES[routeStatus] : undefined;

  useEffect(() => {
    document.title = `${page?.title ?? 'Siparişler'} — Chiconom Yönetim`;
  }, [page]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'order_number',
      header: 'Sipariş No',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <Link to={`/siparisler/${row.original.order_number}`} className="font-mono text-xs font-bold text-brand hover:underline">
            {row.original.order_number}
          </Link>
          {row.original.has_note && (
            <StickyNote className="size-3.5 shrink-0 text-warning" aria-label="Yönetici notu var" />
          )}
        </span>
      ),
      meta: { exportHeader: 'Sipariş No', filterPlaceholder: 'Sipariş no…' },
    },
    {
      accessorKey: 'customer_name',
      header: 'Müşteri',
      cell: ({ row }) => <span className="line-clamp-1 text-sm">{row.original.customer_name ?? '—'}</span>,
      meta: { exportHeader: 'Müşteri', filterPlaceholder: 'Ad soyad…' },
    },
    {
      accessorKey: 'email',
      header: 'E-posta',
      cell: ({ row }) => <span className="line-clamp-1 text-xs text-muted-foreground">{row.original.email ?? '—'}</span>,
      meta: { exportHeader: 'E-posta', filterPlaceholder: 'E-posta…' },
    },
    {
      accessorKey: 'phone',
      header: 'Telefon',
      cell: ({ row }) => <span className="whitespace-nowrap text-xs">{row.original.phone ?? '—'}</span>,
      meta: { exportHeader: 'Telefon', filterPlaceholder: 'Telefon…' },
    },
    {
      accessorKey: 'items_count',
      header: 'Kalem',
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.items_count ?? 0)}</span>,
      meta: { exportHeader: 'Kalem', exportFormat: 'number', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'grand_total',
      header: 'Tutar',
      cell: ({ row }) => <span className="tabular-nums font-medium">{formatPrice(row.original.grand_total)}</span>,
      meta: { exportHeader: 'Tutar', exportFormat: 'currency', align: 'right', filterPlaceholder: 'Tutar…' },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status_label} />,
      meta: {
        exportHeader: 'Durum',
        filterVariant: 'select',
        filterOptions: statusOptions([...ORDER_FLOW, ...ORDER_CLOSED]),
        // Durum sayfasında sütun süzgeci sayfayı bozmasın
        disableFilter: Boolean(routeStatus),
      },
    },
    {
      accessorKey: 'payment_status',
      header: 'Ödeme',
      cell: ({ row }) => <StatusBadge status={String(row.original.payment_status ?? 'unpaid')} />,
      meta: {
        exportHeader: 'Ödeme',
        filterVariant: 'select',
        filterOptions: statusOptions(['paid', 'unpaid', 'refunded', 'partially_refunded', 'failed']),
      },
    },
    {
      accessorKey: 'payment_method',
      header: 'Yöntem',
      cell: ({ row }) => (
        <span className="text-xs">
          {PAYMENT_METHODS.find((m) => m.value === row.original.payment_method)?.label ?? row.original.payment_method ?? '—'}
          {row.original.payment_provider ? <span className="text-muted-foreground"> · {row.original.payment_provider}</span> : null}
        </span>
      ),
      meta: { exportHeader: 'Ödeme Yöntemi', filterVariant: 'select', filterOptions: PAYMENT_METHODS },
    },
    {
      accessorKey: 'invoice_number',
      header: 'Fatura',
      cell: ({ row }) => row.original.has_invoice ? (
        <span className="flex items-center gap-1 font-mono text-[11px] text-success">
          <Receipt className="size-3" /> {row.original.invoice_number ?? 'var'}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground">—</span>
      ),
      meta: { exportHeader: 'Fatura No', disableFilter: true },
    },
    {
      accessorKey: 'created_at',
      header: 'Tarih',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
      ),
      meta: { exportHeader: 'Tarih', exportFormat: 'datetime', filterPlaceholder: 'YYYY-AA-GG' },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const next = row.original.next_statuses?.find((s) => (ORDER_FLOW as readonly string[]).includes(s));

        if (!next || !can('orders.manage')) return null;

        // Kargoya verme takip numarası ister → detaya yönlendir
        if (next === 'shipped') {
          return (
            <Button variant="outline" size="sm" className="gap-1 whitespace-nowrap" asChild>
              <Link to={`/siparisler/${row.original.order_number}#kargo`}>Kargoya Ver <ArrowRight className="size-3.5" /></Link>
            </Button>
          );
        }

        return (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 whitespace-nowrap"
            disabled={busy === row.original.order_number}
            onClick={() => advance(row.original, next)}
          >
            {busy === row.original.order_number ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {ORDER_STATUS_LABELS[next]} <ArrowRight className="size-3.5" />
          </Button>
        );
      },
      meta: { align: 'right', disableFilter: true, skipExport: true },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busy, routeStatus]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/orders',
    columns,
    extraParams: { status, q: search },
    exportFilename: routeStatus ? `siparisler-${routeStatus}` : 'siparisler',
  });

  async function advance(row: Row, next: string) {
    setBusy(row.order_number);

    try {
      const { data } = await adminApi.patch(`/orders/${row.order_number}/status`, { status: next });
      toast.success(data.message);
      table.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={page?.title ?? 'Siparişler'}
        description={page?.description ?? 'Tüm siparişler. Her sütunda arama ve sıralama yapabilir, satırdaki okla siparişi bir sonraki adıma geçirebilirsiniz.'}
        icon={ShoppingBag}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/siparis-panosu">Panoyu Aç</Link>
          </Button>
        }
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Sipariş bulunamadı."
        onRowClick={(row) => navigate(`/siparisler/${row.order_number}`)}
        rowClassName={(row) => (row.status === 'pending' ? 'opacity-70' : undefined)}
        toolbar={
          <>
            {!routeStatus && (
              <div className="flex flex-wrap rounded-lg border border-border bg-card p-0.5">
                {TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setStatus(tab.value)}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                      status === tab.value ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sipariş no, müşteri, e-posta, telefon…"
              className="h-8 w-64 text-xs"
            />
          </>
        }
      />
    </div>
  );
}
