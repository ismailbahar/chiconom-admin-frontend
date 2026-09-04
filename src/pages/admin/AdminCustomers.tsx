import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Mail, Users } from 'lucide-react';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CustomerMailDialog from '@/components/panel/CustomerMailDialog';
import { usePanelAuthStore } from '@/stores/panelAuthStore';
import { Input } from '@/components/ui/input';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { formatPrice, formatNumber, formatDateTime } from '@/lib/utils';

interface Row {
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  order_count: number;
  total_spent: number;
  allow_email_marketing: boolean;
  allow_sms_marketing: boolean;
  is_active: boolean;
  created_at: string | null;
  [key: string]: unknown;
}


/**
 * Müşteri listesi. İzin durumları İYS uyumu için burada görünür.
 */
export default function AdminCustomers() {
  const [search, setSearch] = useState('');
  const [mailRow, setMailRow] = useState<Row | null>(null);
  const can = usePanelAuthStore((s) => s.can);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'full_name',
      header: 'Ad Soyad',
      cell: ({ row }) => (
        <span className="line-clamp-1 text-sm">{row.original.full_name ?? '—'}</span>
      ),
      meta: { exportHeader: 'Ad Soyad', filterPlaceholder: 'Ad…' },
    },
    {
      accessorKey: 'email',
      header: 'E-posta',
      cell: ({ row }) => (
        <span className="line-clamp-1 text-sm">{row.original.email ?? '—'}</span>
      ),
      meta: { exportHeader: 'E-posta', filterPlaceholder: 'E-posta…' },
    },
    {
      accessorKey: 'phone',
      header: 'Telefon',
      cell: ({ row }) => (
        <span className="line-clamp-1 text-sm">{row.original.phone ?? '—'}</span>
      ),
      meta: { exportHeader: 'Telefon', disableFilter: true },
    },
    {
      accessorKey: 'order_count',
      header: 'Sipariş',
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.order_count ?? 0)}</span>
      ),
      meta: { exportHeader: 'Sipariş', exportFormat: 'number', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'total_spent',
      header: 'Harcama',
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{formatPrice(row.original.total_spent)}</span>
      ),
      meta: { exportHeader: 'Harcama', exportFormat: 'currency', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'allow_email_marketing',
      header: 'E-posta İzni',
      cell: ({ row }) => (
        <Badge variant={row.original.allow_email_marketing ? 'success' : 'secondary'}>{row.original.allow_email_marketing ? 'Evet' : 'Hayır'}</Badge>
      ),
      meta: { exportHeader: 'E-posta İzni', exportFormat: 'boolean', disableFilter: true },
    },
    {
      accessorKey: 'allow_sms_marketing',
      header: 'SMS İzni',
      cell: ({ row }) => (
        <Badge variant={row.original.allow_sms_marketing ? 'success' : 'secondary'}>{row.original.allow_sms_marketing ? 'Evet' : 'Hayır'}</Badge>
      ),
      meta: { exportHeader: 'SMS İzni', exportFormat: 'boolean', disableFilter: true },
    },
    {
      accessorKey: 'is_active',
      header: 'Aktif',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'success' : 'secondary'}>{row.original.is_active ? 'Evet' : 'Hayır'}</Badge>
      ),
      meta: { exportHeader: 'Aktif', exportFormat: 'boolean', disableFilter: true },
    },
    {
      accessorKey: 'created_at',
      header: 'Kayıt',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
      ),
      meta: { exportHeader: 'Kayıt', exportFormat: 'datetime', disableFilter: true },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => can('customers.manage') && row.original.email ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setMailRow(row.original)} title="Müşteriye e-posta gönder">
            <Mail className="size-3.5" /> Mail
          </Button>
        </div>
      ) : null,
      meta: { disableFilter: true },
    },
  ], [can]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/customers',
    columns,
    extraParams: { q: search },
    exportFilename: 'musteriler',
  });

  return (
    <div>
      <PageHeader
        title="Müşteriler"
        description="Kayıtlı müşteriler ve alışveriş geçmişleri."
        icon={Users}
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Müşteri bulunamadı."
        toolbar={
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, e-posta, telefon…"
              className="h-8 w-56 text-xs"
            />
          </>
        }
      />

      {mailRow && (
        <CustomerMailDialog
          open
          onOpenChange={(o) => !o && setMailRow(null)}
          target={{ kind: 'customer', id: mailRow.id }}
          email={mailRow.email}
          name={mailRow.full_name}
        />
      )}
    </div>
  );
}
