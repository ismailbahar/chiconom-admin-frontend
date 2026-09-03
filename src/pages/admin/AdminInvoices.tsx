import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Loader2, Receipt, Send, Trash2 } from 'lucide-react';
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
import { usePanelAuthStore } from '@/stores/panelAuthStore';
import { cn, formatDate, formatDateTime, formatPrice } from '@/lib/utils';

interface Row {
  id: number;
  invoice_number: string | null;
  order_number: string | null;
  customer_name: string | null;
  issue_date: string | null;
  total: number;
  status: string;
  status_label?: string;
  source: 'manual' | 'auto';
  has_file: boolean;
  original_name: string | null;
  uploaded_by: string | null;
  sent_to_customer_at: string | null;
  send_count: number;
  created_at: string;
  [key: string]: unknown;
}

const SOURCE_TABS = [
  { value: '', label: 'Tümü' },
  { value: 'manual', label: 'Panelden Yüklenen' },
  { value: 'auto', label: 'e-Fatura (entegratör)' },
];

/** Tarayıcıda indirme: yetkili istekle blob alınır, bağlantı olarak tetiklenir. */
async function downloadInvoice(row: Row) {
  try {
    const response = await adminApi.get(`/invoices/${row.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `Fatura-${row.invoice_number ?? row.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

/**
 * FATURALAR.
 *
 * Fatura muhasebe programında kesilir; PDF'i sipariş detayından yüklenir
 * (numara + tarih + tutar). Burası yüklenen tüm belgelerin listesidir:
 * indirme, müşteriye yeniden gönderme ve silme buradan yapılır.
 * Faturası eksik siparişler menüdeki rozetle görünür.
 */
export default function AdminInvoices() {
  const can = usePanelAuthStore((s) => s.can);
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);

  useEffect(() => {
    document.title = 'Faturalar — Chiconom Yönetim';
  }, []);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'invoice_number',
      header: 'Fatura No',
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-xs font-bold">{row.original.invoice_number ?? '—'}</p>
          {row.original.original_name && (
            <p className="max-w-[180px] truncate text-[11px] text-muted-foreground" title={row.original.original_name}>
              {row.original.original_name}
            </p>
          )}
        </div>
      ),
      meta: { exportHeader: 'Fatura No', filterPlaceholder: 'Fatura no…' },
    },
    {
      accessorKey: 'order_number',
      header: 'Sipariş',
      cell: ({ row }) => row.original.order_number ? (
        <Link to={`/siparisler/${row.original.order_number}`} className="font-mono text-xs font-bold text-brand hover:underline">
          {row.original.order_number}
        </Link>
      ) : '—',
      meta: { exportHeader: 'Sipariş No', filterPlaceholder: 'Sipariş no…' },
    },
    {
      accessorKey: 'customer_name',
      header: 'Müşteri',
      cell: ({ row }) => <span className="line-clamp-1 text-sm">{row.original.customer_name ?? '—'}</span>,
      meta: { exportHeader: 'Müşteri', filterPlaceholder: 'Müşteri…' },
    },
    {
      accessorKey: 'issue_date',
      header: 'Fatura Tarihi',
      cell: ({ row }) => <span className="whitespace-nowrap text-xs">{formatDate(row.original.issue_date)}</span>,
      meta: { exportHeader: 'Fatura Tarihi', exportFormat: 'date', filterPlaceholder: 'YYYY-AA-GG' },
    },
    {
      accessorKey: 'total',
      header: 'Tutar',
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatPrice(row.original.total)}</span>,
      meta: { exportHeader: 'Tutar', exportFormat: 'currency', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'source',
      header: 'Kaynak',
      cell: ({ row }) => <StatusBadge status={row.original.source} />,
      meta: { exportHeader: 'Kaynak', filterVariant: 'select', filterOptions: statusOptions(['manual', 'auto']) },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status_label} />,
      meta: {
        exportHeader: 'Durum',
        filterVariant: 'select',
        filterOptions: statusOptions(['issued', 'sent', 'queued', 'error', 'cancelled']),
      },
    },
    {
      accessorKey: 'sent_to_customer_at',
      header: 'Müşteriye Gönderim',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {row.original.sent_to_customer_at
            ? `${formatDateTime(row.original.sent_to_customer_at)}${row.original.send_count > 1 ? ` (${row.original.send_count}×)` : ''}`
            : <span className="text-warning">Gönderilmedi</span>}
        </span>
      ),
      meta: { exportHeader: 'Gönderim', exportFormat: 'datetime', disableFilter: true },
    },
    {
      accessorKey: 'uploaded_by',
      header: 'Yükleyen',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.uploaded_by ?? '—'}</span>,
      meta: { exportHeader: 'Yükleyen', disableFilter: true },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const item = row.original;
        const busy = busyId === item.id;

        return (
          <div className="flex justify-end gap-1">
            {item.has_file && (
              <Button variant="ghost" size="icon" title="PDF'i indir" onClick={() => downloadInvoice(item)}>
                <Download className="size-4" />
              </Button>
            )}
            {can('invoices.manage') && item.has_file && (
              <Button variant="ghost" size="icon" title="Müşteriye (yeniden) gönder" disabled={busy} onClick={() => send(item)}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            )}
            {can('invoices.manage') && (
              <Button variant="ghost" size="icon" className="text-destructive" title="Sil" onClick={() => setDeleteRow(item)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        );
      },
      meta: { align: 'right', disableFilter: true, skipExport: true },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busyId]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/invoices',
    columns,
    extraParams: { source, q: search },
    exportFilename: 'faturalar',
  });

  async function send(row: Row) {
    setBusyId(row.id);

    try {
      const { data } = await adminApi.post(`/invoices/${row.id}/send`);
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
        title="Faturalar"
        description="Siparişe yüklenen fatura PDF'leri. Yükleme sipariş detayından yapılır; buradan indirir, yeniden gönderir veya silersiniz."
        icon={Receipt}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/siparisler/durum/shipped">Faturası eksik siparişler</Link>
          </Button>
        }
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Henüz fatura yüklenmemiş."
        toolbar={
          <>
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              {SOURCE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setSource(tab.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    source === tab.value ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Fatura no, sipariş no, müşteri…"
              className="h-8 w-56 text-xs"
            />
          </>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteRow)}
        onOpenChange={(open) => { if (!open) setDeleteRow(null); }}
        title="Faturayı sil"
        description={`${deleteRow?.invoice_number ?? ''} numaralı fatura kaydı ve PDF dosyası silinecek. Müşterinin hesabından da kalkar.`}
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          await adminApi.delete(`/invoices/${deleteRow?.id}`);
          setDeleteRow(null);
          table.refresh();
        }}
        successMessage="Fatura silindi."
      />
    </div>
  );
}
