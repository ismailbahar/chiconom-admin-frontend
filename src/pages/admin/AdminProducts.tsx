import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Eye, EyeOff, Package, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import StatusBadge, { statusOptions } from '@/components/panel/StatusBadge';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { EditableField, EditableSwitch } from '@/components/panel/EditableCell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SmartImage from '@/components/SmartImage';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatNumber, formatPrice } from '@/lib/utils';

interface ProductRow {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  cover_image: string | null;
  category: string | null;
  brand: string | null;
  price: number;
  list_price: number;
  stock: number;
  available_stock: number | null;
  is_low_stock: boolean;
  variants_count: number;
  sold_count: number;
  rating: number;
  status: string;
  status_label?: string;
  is_featured: boolean;
  is_new: boolean;
  created_at: string;
}

const TABS = [
  { value: '', label: 'Tümü' },
  { value: 'active', label: 'Yayında' },
  { value: 'draft', label: 'Taslak' },
  { value: 'passive', label: 'Pasif' },
];

/**
 * ÜRÜN LİSTESİ.
 *
 * Fiyat ve stok tabloda doğrudan düzenlenir; ad, kategori, marka, SKU,
 * fiyat, stok ve durum sütunları sunucuda süzülüp sıralanır. Seçili ürünlere
 * toplu işlem (yayına al, pasifle, öne çıkar, sil) uygulanır.
 */
export default function AdminProducts() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const lowStock = params.get('low_stock') === '1';

  useEffect(() => {
    document.title = 'Ürünler — Chiconom Yönetim';
  }, []);

  const columns = useMemo<ColumnDef<ProductRow, unknown>[]>(() => [
    {
      id: 'select',
      header: () => <span className="sr-only">Seç</span>,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selected.includes(row.original.id)}
          onChange={(e) =>
            setSelected((prev) =>
              e.target.checked ? [...prev, row.original.id] : prev.filter((id) => id !== row.original.id),
            )
          }
          className="rounded border-input accent-brand"
        />
      ),
      meta: { skipExport: true, disableFilter: true, width: 40, align: 'center' },
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Ürün',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
            <SmartImage src={row.original.cover_image} alt={row.original.name} imgClassName="object-contain p-1" />
          </div>
          <div className="min-w-0">
            <Link to={`/urunler/${row.original.id}`} className="line-clamp-1 text-sm font-medium hover:text-brand hover:underline">
              {row.original.name}
            </Link>
            <p className="text-[11px] text-muted-foreground">
              {row.original.variants_count > 0 ? `${row.original.variants_count} varyant` : 'Varyantsız'}
              {row.original.is_new ? ' · Yeni' : ''}
            </p>
          </div>
        </div>
      ),
      meta: { exportHeader: 'Ürün Adı', filterPlaceholder: 'Ürün ara…' },
    },
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku ?? '—'}</span>,
      meta: { exportHeader: 'SKU', filterPlaceholder: 'SKU…' },
    },
    {
      accessorKey: 'category',
      header: 'Kategori',
      cell: ({ row }) => <span className="text-sm">{row.original.category ?? 'Kategorisiz'}</span>,
      meta: { exportHeader: 'Kategori', filterPlaceholder: 'Kategori…' },
      enableSorting: false,
    },
    {
      accessorKey: 'brand',
      header: 'Marka',
      cell: ({ row }) => <span className="text-sm">{row.original.brand ?? '—'}</span>,
      meta: { exportHeader: 'Marka', filterPlaceholder: 'Marka…' },
      enableSorting: false,
    },
    {
      accessorKey: 'price',
      header: 'Fiyat',
      // Satır içi düzenleme: kalem ikonundan açılan popup
      cell: ({ row }) => (
        <div className="flex flex-col items-end">
          <EditableField
            value={row.original.price}
            type="currency"
            label="Satış Fiyatı"
            hint="KDV dahil fiyat"
            suffix="₺"
            min={0}
            onSave={async (next) => {
              await adminApi.patch(`/products/${row.original.id}`, { price: Number(next) });
              table.patchRow(row.original.id, { price: Number(next) });
            }}
          />
          {row.original.list_price > row.original.price && (
            <span className="text-[10px] text-muted-foreground line-through">{formatPrice(row.original.list_price)}</span>
          )}
        </div>
      ),
      meta: { exportHeader: 'Fiyat', exportFormat: 'currency', align: 'right', filterPlaceholder: 'Fiyat…' },
    },
    {
      accessorKey: 'stock',
      header: 'Stok',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.original.is_low_stock && <AlertTriangle className="size-3.5 text-warning" />}
          <EditableField
            value={row.original.stock}
            type="number"
            label="Stok Adedi"
            hint={row.original.variants_count > 0
              ? 'Varyantlı üründe stok varyant bazında düzenlenir; buradaki toplam bilgi amaçlıdır.'
              : 'Stok değişimi hareket defterine yazılır.'}
            min={0}
            warnWhenZero
            onSave={async (next) => {
              await adminApi.patch(`/products/${row.original.id}`, { stock: Number(next) });
              table.patchRow(row.original.id, { stock: Number(next) });
            }}
          />
        </div>
      ),
      meta: { exportHeader: 'Stok', exportFormat: 'number', align: 'right', filterPlaceholder: 'Stok…' },
    },
    {
      accessorKey: 'sold_count',
      header: 'Satış',
      cell: ({ row }) => <span className="text-sm tabular-nums">{formatNumber(row.original.sold_count)}</span>,
      meta: { exportHeader: 'Satış Adedi', exportFormat: 'number', align: 'right', disableFilter: true },
    },
    {
      accessorKey: 'is_featured',
      header: 'Öne Çıkan',
      cell: ({ row }) => (
        <EditableSwitch
          value={row.original.is_featured}
          labels={['Hayır', 'Evet']}
          onSave={async (next) => {
            await adminApi.patch(`/products/${row.original.id}`, { is_featured: next });
            table.patchRow(row.original.id, { is_featured: next });
          }}
        />
      ),
      meta: {
        exportHeader: 'Öne Çıkan', exportFormat: 'boolean',
        filterVariant: 'select', filterOptions: [{ value: '1', label: 'Evet' }, { value: '0', label: 'Hayır' }],
      },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status_label} />,
      meta: {
        exportHeader: 'Durum',
        filterVariant: 'select',
        filterOptions: statusOptions(['active', 'draft', 'passive']),
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to={`/urunler/${row.original.id}`}><Pencil className="size-3.5" /> Düzenle</Link>
          </Button>
          <Button
            variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10"
            title="Sil"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
      meta: { skipExport: true, disableFilter: true, align: 'right' },
      enableSorting: false,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selected]);

  const table = useServerTable<ProductRow>({
    api: adminApi,
    endpoint: '/products',
    columns,
    extraParams: { status, q: search, low_stock: lowStock ? 1 : undefined },
    exportFilename: 'urunler',
  });

  const bulk = async (action: 'activate' | 'passive' | 'feature' | 'unfeature' | 'delete') => {
    try {
      const { data } = await adminApi.post('/products/bulk', { ids: selected, action });
      toast.success(data.message ?? `${selected.length} ürün güncellendi.`);
      setSelected([]);
      table.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Ürünler"
        description="Katalogdaki tüm ürünler. Fiyat ve stoğu tabloda doğrudan düzenleyebilir, her sütunda arama yapabilirsiniz."
        icon={Package}
        actions={
          selected.length > 0 ? (
            <>
              <Badge variant="soft">{selected.length} seçili</Badge>
              <Button variant="success" size="sm" onClick={() => bulk('activate')}>
                <Eye className="size-4" /> Yayına Al
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk('passive')}>
                <EyeOff className="size-4" /> Pasifle
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk('feature')}>
                <Star className="size-4" /> Öne Çıkar
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk('unfeature')}>Öne Çıkarma</Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDelete(true)}>
                <Trash2 className="size-4" /> Sil
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Temizle</Button>
            </>
          ) : (
            <Button size="sm" variant="deal" asChild>
              <Link to="/urunler/yeni"><Plus className="size-4" /> Yeni Ürün</Link>
            </Button>
          )
        }
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Ürün bulunamadı."
        toolbar={
          <>
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => { setStatus(tab.value); setSelected([]); }}
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
              placeholder="Ürün adı, SKU veya barkod…"
              className="h-8 w-56 text-xs"
            />

            {lowStock && (
              <Badge variant="warning" className="gap-1">
                Kritik stok
                <button onClick={() => { params.delete('low_stock'); setParams(params); }}>
                  <X className="size-3" />
                </button>
              </Badge>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Ürünü sil"
        description="Bu işlem geri alınamaz. Siparişi olan ürünler silinmez, pasife alınır."
        confirmLabel="Sil"
        variant="destructive"
        successMessage="Ürün silindi."
        onConfirm={async () => {
          await adminApi.delete(`/products/${deleteId}`);
          table.removeRow(deleteId!);
        }}
      />

      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title={`${selected.length} ürünü sil`}
        description="Seçili ürünler silinir. Siparişi olanlar silinmez, pasife alınır."
        confirmLabel="Sil"
        variant="destructive"
        onConfirm={async () => { await bulk('delete'); }}
      />
    </div>
  );
}
