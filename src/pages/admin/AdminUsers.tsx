import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { UserCog } from 'lucide-react';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface Row {
  id: number;
  name: string | null;
  email: string | null;
  title: string | null;
  is_active: boolean;
  last_login_at: string | null;
  [key: string]: unknown;
}


/**
 * Yönetim kullanıcıları ve rolleri.
 */
export default function AdminUsers() {
  const [search, setSearch] = useState('');

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Ad Soyad',
      cell: ({ row }) => (
        <span className="line-clamp-1 text-sm">{row.original.name ?? '—'}</span>
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
      accessorKey: 'title',
      header: 'Görev',
      cell: ({ row }) => (
        <span className="line-clamp-1 text-sm">{row.original.title ?? '—'}</span>
      ),
      meta: { exportHeader: 'Görev', disableFilter: true },
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
      accessorKey: 'last_login_at',
      header: 'Son Giriş',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.original.last_login_at)}</span>
      ),
      meta: { exportHeader: 'Son Giriş', exportFormat: 'datetime', disableFilter: true },
    },
  ], []);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/users',
    columns,
    extraParams: { q: search },
    exportFilename: 'kullanicilar',
  });

  return (
    <div>
      <PageHeader
        title="Kullanıcılar"
        description="Yönetim personeli ve rolleri."
        icon={UserCog}
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Kullanıcı bulunamadı."
        toolbar={
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad veya e-posta…"
              className="h-8 w-56 text-xs"
            />
          </>
        }
      />
    </div>
  );
}
