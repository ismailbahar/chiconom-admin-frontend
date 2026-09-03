import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import StatusBadge, { statusOptions } from '@/components/panel/StatusBadge';
import { Input } from '@/components/ui/input';
import SmartImage from '@/components/SmartImage';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { cn, formatNumber, formatDateTime } from '@/lib/utils';

interface Row {
  id: number;
  image: string | null;
  title: string | null;
  product_count: number;
  sold_count: number;
  ends_at: string | null;
  status: string | null;
  [key: string]: unknown;
}

const TABS = [
  { value: '', label: 'Tümü' },
  { value: 'active', label: 'Yayında' },
  { value: 'paused', label: 'Duraklatılan' },
  { value: 'ended', label: 'Sona Eren' },
  { value: 'draft', label: 'Taslak' },
];

/**
 * Kampanya listesi. Süreli indirimler; yeni kampanya buradan açılır.
 */
export default function AdminCampaigns() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  /** Taslak kampanya açıp doğrudan düzenleme ekranına geçer. */
  const yeniKampanya = async () => {
    try {
      const { data } = await adminApi.post('/campaigns', { title: 'Yeni Kampanya', status: 'draft', discount_type: 'percent', discount_value: 10 });
      navigate(`/kampanyalar/${data.data.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'image',
      header: 'Görsel',
      cell: ({ row }) => (
        <div className="size-9 overflow-hidden rounded bg-secondary/40"><SmartImage src={row.original.image} alt="" imgClassName="object-contain p-0.5" /></div>
      ),
      meta: { exportHeader: 'Görsel', skipExport: true, disableFilter: true },
    },
    {
      accessorKey: 'title',
      header: 'Kampanya',
      cell: ({ row }) => (
        <Link to={`/kampanyalar/${row.original.id}`} className="line-clamp-1 text-sm font-medium hover:text-brand hover:underline">
          {row.original.title ?? '—'}
        </Link>
      ),
      meta: { exportHeader: 'Kampanya', filterPlaceholder: 'Başlık…' },
    },
    {
      accessorKey: 'product_count',
      header: 'Ürün',
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.product_count ?? 0)}</span>
      ),
      meta: { exportHeader: 'Ürün', exportFormat: 'number', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'sold_count',
      header: 'Satılan',
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.sold_count ?? 0)}</span>
      ),
      meta: { exportHeader: 'Satılan', exportFormat: 'number', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'ends_at',
      header: 'Bitiş',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.original.ends_at)}</span>
      ),
      meta: { exportHeader: 'Bitiş', exportFormat: 'datetime', filterPlaceholder: 'YYYY-AA-GG' },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => (
        <StatusBadge status={String(row.original.status ?? '')} label={row.original.status_label as string | undefined} />
      ),
      meta: { exportHeader: 'Durum', filterVariant: 'select', filterOptions: statusOptions(['draft', 'active', 'paused', 'ended']) },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link to={`/kampanyalar/${row.original.id}`}><Pencil className="size-3.5" /> Yönet</Link>
        </Button>
      ),
      meta: { skipExport: true, disableFilter: true, align: 'right' },
      enableSorting: false,
    },
  ], []);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/campaigns',
    columns,
    extraParams: { status, q: search },
    exportFilename: 'kampanyalar',
  });

  return (
    <div>
      <PageHeader
        title="Kampanyalar"
        description="Süreli indirimler. Geri sayım, stok limiti ve kampanya ürünleri buradan yönetilir."
        icon={Zap}
        actions={
          <Button variant="deal" size="sm" onClick={yeniKampanya}>
            <Plus className="size-4" /> Yeni Kampanya
          </Button>
        }
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Kampanya bulunamadı."
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
              placeholder="Kampanya adı…"
              className="h-8 w-56 text-xs"
            />
          </>
        }
      />
    </div>
  );
}
