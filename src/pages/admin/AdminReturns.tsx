import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Banknote, Check, Loader2, PackageCheck, RotateCcw, Truck, X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import StatusBadge, { statusOptions } from '@/components/panel/StatusBadge';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatDateTime, formatPrice } from '@/lib/utils';

interface Row {
  id: number;
  code: string | null;
  order_number: string | null;
  customer: string | null;
  reason_label: string | null;
  description: string | null;
  decision_note: string | null;
  refund_amount: number;
  refund_completed: boolean;
  return_tracking_number: string | null;
  items_count: number;
  status: string;
  status_label: string;
  created_at: string | null;
  [key: string]: unknown;
}

/**
 * SEKMELER — sürecin gerçek sırasına göre dizilir.
 *
 * "Kargoda" (shipped_back) sekmesi kritik: müşteri ürünü fiilen geri
 * göndermiştir ve sıra bizdedir. Bu sekme yokken o durumdaki talepler
 * ekranda HİÇBİR yerde görünmüyor, ama kenar çubuğundaki rozete
 * sayılıyordu — "2 talep var" yazıp liste boş geliyordu.
 *
 * Kural: rozetin saydığı her durumun bir sekmesi olmalı.
 */
const TABS = [
  { value: 'requested', label: 'Bekleyen' },
  { value: 'approved', label: 'Onaylanan' },
  { value: 'shipped_back', label: 'Kargoda' },
  { value: 'received', label: 'Teslim Alınan' },
  { value: 'refunded', label: 'İade Edilen' },
  { value: 'rejected', label: 'Reddedilen' },
  { value: '', label: 'Tümü' },
];

/** Rozetin (returns_open) saydığı durumlar — sunucuyla birebir aynı. */
const OPEN_STATUSES = ['requested', 'approved', 'shipped_back'];

export default function AdminReturns() {
  const [status, setStatus] = useState('requested');
  const [search, setSearch] = useState('');
  const [approveRow, setApproveRow] = useState<Row | null>(null);
  const [rejectRow, setRejectRow] = useState<Row | null>(null);
  const [refundRow, setRefundRow] = useState<Row | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'code',
      header: 'Talep No',
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-xs font-bold">{row.original.code ?? '—'}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.original.order_number ?? '—'}</p>
        </div>
      ),
      meta: { exportHeader: 'Talep No', filterPlaceholder: 'Kod…' },
    },
    {
      accessorKey: 'order_number',
      header: 'Sipariş',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.order_number ?? '—'}</span>,
      meta: { exportHeader: 'Sipariş No', filterPlaceholder: 'Sipariş no…' },
      enableSorting: false,
    },
    {
      accessorKey: 'customer',
      header: 'Müşteri',
      cell: ({ row }) => <p className="line-clamp-1 text-sm">{row.original.customer || '—'}</p>,
      meta: { exportHeader: 'Müşteri', disableFilter: true },
      enableSorting: false,
    },
    {
      accessorKey: 'reason_label',
      header: 'Sebep',
      cell: ({ row }) => (
        <div className="max-w-[240px]">
          <p className="text-sm">{row.original.reason_label ?? '—'}</p>
          {row.original.description && (
            <p className="line-clamp-2 text-[11px] text-muted-foreground">{row.original.description}</p>
          )}
          <p className="text-[11px] text-muted-foreground">{row.original.items_count} kalem</p>
        </div>
      ),
      meta: { exportHeader: 'Sebep', filterPlaceholder: 'Sebep…' },
      enableSorting: false,
    },
    {
      accessorKey: 'refund_amount',
      header: 'İade Tutarı',
      cell: ({ row }) => (
        <div className="text-right">
          <p className="font-medium tabular-nums">{formatPrice(row.original.refund_amount)}</p>
          {row.original.refund_completed && (
            <p className="text-[11px] text-success">Ödendi</p>
          )}
        </div>
      ),
      meta: { exportHeader: 'İade Tutarı', exportFormat: 'currency', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => (
        <div>
          <StatusBadge status={row.original.status} label={row.original.status_label} />

          {/* Kargo takip numarasını müşteri girer — ispat aracıdır */}
          {row.original.return_tracking_number && (
            <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <Truck className="size-3" /> {row.original.return_tracking_number}
            </p>
          )}
          {row.original.decision_note && (
            <p className="mt-1 max-w-[180px] text-[11px] text-muted-foreground">{row.original.decision_note}</p>
          )}
        </div>
      ),
      meta: { exportHeader: 'Durum', filterVariant: 'select', filterOptions: statusOptions(['requested', 'approved', 'shipped_back', 'received', 'refunded', 'rejected']), disableFilter: Boolean(status) },
    },
    {
      accessorKey: 'created_at',
      header: 'Tarih',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
      meta: { exportHeader: 'Tarih', exportFormat: 'datetime', filterPlaceholder: 'YYYY-AA-GG' },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const item = row.original;
        const busy = busyId === item.id;

        return (
          <div className="flex flex-wrap justify-end gap-1">
            {item.status === 'requested' && (
              <>
                <Button variant="ghost" size="sm" className="text-success" disabled={busy} onClick={() => setApproveRow(item)}>
                  <Check className="size-3.5" /> Onayla
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => setRejectRow(item)}>
                  <X className="size-3.5" /> Reddet
                </Button>
              </>
            )}

            {/* Ürün geri geldi: stoğa işlenir ve para iadesi açılır */}
            {['approved', 'shipped_back'].includes(item.status) && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => decide(item, 'received')}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />}
                Teslim Alındı
              </Button>
            )}

            {['approved', 'received'].includes(item.status) && !item.refund_completed && (
              <Button variant="ghost" size="sm" className="text-brand" disabled={busy} onClick={() => setRefundRow(item)}>
                <Banknote className="size-3.5" /> Para İadesi
              </Button>
            )}
          </div>
        );
      },
      meta: { align: 'right', disableFilter: true, skipExport: true },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busyId, status]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/returns',
    columns,
    extraParams: { status, q: search },
    exportFilename: 'iade-talepleri',
  });

  async function decide(row: Row, next: 'received') {
    setBusyId(row.id);

    try {
      const { data } = await adminApi.post(`/returns/${row.id}/decide`, { status: next });
      toast.success(data.message);
      table.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="İade Talepleri"
        description="Müşteri iade talebi açar; onaylanan ürün geri geldiğinde teslim alınır ve para iadesi yapılır."
        icon={RotateCcw}
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText={
          OPEN_STATUSES.includes(status)
            ? 'Bu durumda iade talebi yok. Diğer sekmeleri de kontrol edin.'
            : 'İade talebi yok.'
        }
        toolbar={
          <>
            <div className="flex flex-wrap rounded-lg border border-border bg-card p-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.value || 'all'}
                  onClick={() => setStatus(tab.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    status === tab.value ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Talep no…"
              className="h-8 w-48 text-xs"
            />
          </>
        }
      />

      {/* ── Onay ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(approveRow)}
        onOpenChange={(open) => { if (!open) setApproveRow(null); }}
        title="İade talebini onayla"
        description="Müşteriye ürünü nasıl göndereceği e-posta ile iletilir. Ürün elinize ulaştığında “Teslim Alındı” ile stoğa işleyip para iadesini yapabilirsiniz."
        confirmLabel="Onayla"
        optionalReason
        reasonLabel="Karar notu"
        reasonPlaceholder="İsteğe bağlı; müşteriye gönderilen e-postada görünür…"
        onConfirm={async (reason) => {
          await adminApi.post(`/returns/${approveRow?.id}/decide`, { status: 'approved', note: reason });
          setApproveRow(null);
          table.refresh();
        }}
      />

      {/* ── Ret ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(rejectRow)}
        onOpenChange={(open) => { if (!open) setRejectRow(null); }}
        title="İade talebini reddet"
        description="Gerekçe müşteriye e-posta ile iletilir. Tüketicinin Hakem Heyeti’ne başvurma hakkı saklı kalır; gerekçeyi buna göre yazın."
        variant="destructive"
        confirmLabel="Reddet"
        requireReason
        reasonLabel="Ret gerekçesi"
        reasonPlaceholder="Örn. ürün kullanılmış olarak geri gönderilmiş…"
        onConfirm={async (reason) => {
          await adminApi.post(`/returns/${rejectRow?.id}/decide`, { status: 'rejected', note: reason });
          setRejectRow(null);
          table.refresh();
        }}
      />

      <RefundDialog
        row={refundRow}
        onClose={() => setRefundRow(null)}
        onDone={() => { setRefundRow(null); table.refresh(); }}
      />
    </div>
  );
}

/**
 * PARA İADESİ.
 *
 * Tutar önceden doldurulur ama değiştirilebilir: kargo bedeli düşülmesi ya da
 * kısmi iade gerekebilir. Sunucu yine de tahsil edilenden fazlasını
 * göndermeyi reddeder.
 */
function RefundDialog({
  row, onClose, onDone,
}: {
  row: Row | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!row) return;

    setSending(true);

    try {
      const { data } = await adminApi.post(`/returns/${row.id}/refund`, {
        amount: amount ? Number(amount) : undefined,
      });
      toast.success(data.message);
      setAmount('');
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={Boolean(row)}
      onOpenChange={(open) => { if (!open && !sending) { setAmount(''); onClose(); } }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Para iadesi</DialogTitle>
          <DialogDescription>
            {row?.code} · {row?.customer} — tutar müşterinin ödeme yaptığı karta gönderilir.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">İade tutarı (TL)</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={row ? String(row.refund_amount) : '0,00'}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Boş bırakırsanız talep tutarı ({row ? formatPrice(row.refund_amount) : '—'}) gönderilir.
          </p>
        </div>

        <p className="rounded-lg bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Aynı gün yapılan tam tutarlı iadeler POS tarafında otomatik olarak
          <strong> iptale (void)</strong> çevrilir; müşterinin blokajı anında çözülür.
          Diğer hâllerde bankaya bağlı olarak 1-14 iş günü sürer.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={sending}>Vazgeç</Button>
          <Button variant="deal" onClick={submit} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
            İadeyi Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
