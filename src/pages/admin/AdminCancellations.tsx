import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle, Check, Loader2, RefreshCw, X, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import StatusBadge, { statusOptions } from '@/components/panel/StatusBadge';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  admin_note: string | null;
  order_total: number;
  payment_status: string | null;
  refund_amount: number;
  refund_completed: boolean;
  status: string;
  status_label: string;
  created_at: string | null;
  [key: string]: unknown;
}

const TABS = [
  { value: 'requested', label: 'Bekleyen' },
  { value: '', label: 'Tümü' },
  { value: 'approved', label: 'Onaylanan' },
  { value: 'rejected', label: 'Reddedilen' },
];

/**
 * İPTAL TALEPLERİ.
 *
 * Kargoya verilmemiş siparişte müşteri kendisi iptal edebilir; kargoya
 * verildikten sonra talep açılır ve karar burada verilir.
 *
 * ONAY = sipariş iptali + PARA İADESİ. İade POS'ta başarısız olursa iptal
 * kararı geçerli kalır ve satırda "iade başarısız" uyarısı belirir; yönetici
 * "İadeyi Yeniden Dene" ile tekrar gönderebilir. Müşteriyi iptalsiz bırakmak
 * daha kötü bir sonuç olurdu.
 */
export default function AdminCancellations() {
  const [status, setStatus] = useState('requested');
  const [search, setSearch] = useState('');
  const [rejectRow, setRejectRow] = useState<Row | null>(null);
  const [approveRow, setApproveRow] = useState<Row | null>(null);
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
        <div className="max-w-[260px]">
          <p className="text-sm">{row.original.reason_label ?? '—'}</p>
          {row.original.description && (
            <p className="line-clamp-2 text-[11px] text-muted-foreground">{row.original.description}</p>
          )}
        </div>
      ),
      meta: { exportHeader: 'Sebep', filterPlaceholder: 'Sebep…' },
      enableSorting: false,
    },
    {
      accessorKey: 'order_total',
      header: 'Tutar',
      cell: ({ row }) => (
        <div className="text-right">
          <p className="font-medium tabular-nums">{formatPrice(row.original.order_total)}</p>
          {row.original.refund_amount > 0 && (
            <p className={cn(
              'text-[11px] tabular-nums',
              row.original.refund_completed ? 'text-success' : 'text-warning',
            )}
            >
              {row.original.refund_completed ? 'İade edildi' : 'İade bekliyor'}: {formatPrice(row.original.refund_amount)}
            </p>
          )}
        </div>
      ),
      meta: { exportHeader: 'Tutar', exportFormat: 'currency', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => (
        <div>
          <StatusBadge status={row.original.status} label={row.original.status_label} />
          {row.original.admin_note && (
            <p className="mt-1 max-w-[200px] text-[11px] text-muted-foreground">{row.original.admin_note}</p>
          )}
        </div>
      ),
      meta: { exportHeader: 'Durum', filterVariant: 'select', filterOptions: statusOptions(['requested', 'approved', 'rejected', 'withdrawn']), disableFilter: Boolean(status) },
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

        if (item.status === 'requested') {
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" className="text-success" disabled={busy} onClick={() => setApproveRow(item)}>
                <Check className="size-3.5" /> Onayla
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => setRejectRow(item)}>
                <X className="size-3.5" /> Reddet
              </Button>
            </div>
          );
        }

        // Onaylandı ama para geri gönderilemedi → elle tekrar denenebilir
        if (item.status === 'approved' && item.refund_amount > 0 && !item.refund_completed) {
          return (
            <div className="flex items-center justify-end gap-1">
              <AlertTriangle className="size-3.5 text-warning" />
              <Button variant="ghost" size="sm" className="text-warning" disabled={busy} onClick={() => retryRefund(item)}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                İadeyi Yeniden Dene
              </Button>
            </div>
          );
        }

        return null;
      },
      meta: { align: 'right', disableFilter: true, skipExport: true },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busyId, status]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/cancellations',
    columns,
    extraParams: { status, q: search },
    exportFilename: 'iptal-talepleri',
  });

  async function retryRefund(row: Row) {
    setBusyId(row.id);

    try {
      const { data } = await adminApi.post(`/cancellations/${row.id}/refund`);
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
        title="İptal Talepleri"
        description="Onaylanan talepte sipariş iptal edilir ve ödeme alınmışsa tutar müşterinin kartına iade edilir."
        icon={XCircle}
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="İptal talebi yok."
        toolbar={
          <>
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
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
              className="h-8 w-56 text-xs"
            />
          </>
        }
      />

      {/* Onay — para iadesini de tetikler */}
      <ConfirmDialog
        open={Boolean(approveRow)}
        onOpenChange={(open) => { if (!open) setApproveRow(null); }}
        title="İptal talebini onayla"
        description={
          approveRow?.payment_status === 'paid'
            ? `Sipariş iptal edilecek, stok geri alınacak ve ${formatPrice(approveRow?.refund_amount ?? 0)} tutarındaki ödeme müşterinin kartına iade edilecek.`
            : 'Sipariş iptal edilecek ve stok rezervi serbest bırakılacak. Ödeme alınmadığı için iade yapılmayacak.'
        }
        confirmLabel="Onayla ve İptal Et"
        optionalReason
        reasonLabel="Karar notu"
        reasonPlaceholder="İsteğe bağlı; müşteriye giden e-postada görünür…"
        onConfirm={async (reason) => {
          await adminApi.post(`/cancellations/${approveRow?.id}/decide`, {
            status: 'approved',
            note: reason,
            refund: true,
          });
          setApproveRow(null);
          table.refresh();
        }}
      />

      {/* Ret */}
      <ConfirmDialog
        open={Boolean(rejectRow)}
        onOpenChange={(open) => { if (!open) setRejectRow(null); }}
        title="İptal talebini reddet"
        description="Gerekçe müşteriye e-posta ile iletilir. Sipariş kargoya verildiyse müşteri iade sürecine yönlendirilir."
        variant="destructive"
        confirmLabel="Reddet"
        requireReason
        reasonLabel="Ret gerekçesi"
        reasonPlaceholder="Örn. sipariş kargoya teslim edilmiş durumda…"
        onConfirm={async (reason) => {
          await adminApi.post(`/cancellations/${rejectRow?.id}/decide`, {
            status: 'rejected',
            note: reason,
          });
          setRejectRow(null);
          table.refresh();
        }}
      />
    </div>
  );
}
