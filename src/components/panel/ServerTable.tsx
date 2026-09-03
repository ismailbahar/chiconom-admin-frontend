import { useEffect, useRef, useState } from 'react';
import {
  type ColumnDef, type ColumnFiltersState, type PaginationState, type SortingState,
  type Updater, type VisibilityState,
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Columns3, FileSpreadsheet, Loader2, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ColumnMeta } from '@/lib/exportExcel';

const PAGE_SIZES = [10, 20, 50, 100, 200];

/** Sütun filtre kutusu — yazarken her tuşta istek atmasın diye geciktirilir. */
function DebouncedInput({
  value: initial,
  onChange,
  placeholder = 'Filtrele…',
  delay = 400,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  delay?: number;
}) {
  const [value, setValue] = useState(initial ?? '');

  useEffect(() => setValue(initial ?? ''), [initial]);

  useEffect(() => {
    if ((initial ?? '') === value) return;
    const timer = setTimeout(() => onChange(value), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      className="h-7 w-full rounded border border-input bg-background px-2 text-xs font-normal normal-case tracking-normal
                 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

export interface ServerTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** true = sunucu taraflı (varsayılan). false = istemcide sırala/filtrele. */
  serverSide?: boolean;

  pageCount?: number;
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  loading?: boolean;
  error?: boolean;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
  columnVisibility?: VisibilityState;
  exporting?: boolean;

  onPaginationChange?: (u: Updater<PaginationState>) => void;
  onSortingChange?: (u: Updater<SortingState>) => void;
  onColumnFiltersChange?: (u: Updater<ColumnFiltersState>) => void;
  onColumnVisibilityChange?: (u: Updater<VisibilityState>) => void;
  onExport?: () => void;
  onRetry?: () => void;

  enableColumnFilters?: boolean;
  enableColumnVisibility?: boolean;
  emptyText?: string;
  /** Sol tarafa yerleşen ekrana özel kontroller (sekmeler, tarih aralığı) */
  toolbar?: React.ReactNode;
  /** Satıra tıklanınca çalışır (detay sayfasına git) */
  onRowClick?: (row: TData) => void;
  /** Satıra ek sınıf (durum rengi vb.) */
  rowClassName?: (row: TData) => string | undefined;
}

/**
 * Panellerin tek tablo bileşeni.
 *
 * Sunucu taraflı sayfalama/sıralama/filtreleme yapar; backend'deki
 * `ServerTableQuery` trait'iyle aynı sözleşmeyi konuşur. `useServerTable`
 * hook'undan gelen `tableProps` doğrudan buraya yayılır.
 */
export default function ServerTable<TData>({
  columns, data, serverSide = true,
  pageCount = 1, pageIndex = 0, pageSize = 20, total,
  loading = false, error = false,
  sorting, columnFilters, columnVisibility, exporting = false,
  onPaginationChange, onSortingChange, onColumnFiltersChange, onColumnVisibilityChange,
  onExport, onRetry,
  enableColumnFilters = true, enableColumnVisibility = true,
  emptyText = 'Kayıt bulunamadı.',
  toolbar, onRowClick, rowClassName,
}: ServerTableProps<TData>) {
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const lastColSpan = useRef(columns.length);

  // İstemci modunda kullanılan iç durum
  const [intPagination, setIntPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [intSorting, setIntSorting] = useState<SortingState>(sorting ?? []);
  const [intFilters, setIntFilters] = useState<ColumnFiltersState>(columnFilters ?? []);
  const [intVisibility, setIntVisibility] = useState<VisibilityState>(columnVisibility ?? {});

  const table = useReactTable({
    data,
    columns,
    ...(serverSide
      ? { pageCount: pageCount || 1, manualPagination: true, manualSorting: true, manualFiltering: true }
      : {}),
    state: serverSide
      ? {
          pagination: { pageIndex, pageSize },
          sorting: sorting ?? [],
          columnFilters: columnFilters ?? [],
          ...(columnVisibility ? { columnVisibility } : {}),
        }
      : {
          pagination: intPagination,
          sorting: intSorting,
          columnFilters: intFilters,
          columnVisibility: intVisibility,
        },
    onPaginationChange: serverSide ? onPaginationChange : setIntPagination,
    onSortingChange: serverSide ? onSortingChange : setIntSorting,
    onColumnFiltersChange: serverSide ? onColumnFiltersChange : setIntFilters,
    onColumnVisibilityChange: serverSide ? onColumnVisibilityChange : setIntVisibility,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    ...(serverSide
      ? {}
      : {
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
        }),
  });

  const visibleLeaf = table.getVisibleLeafColumns();
  const colSpan = visibleLeaf.length || lastColSpan.current;
  lastColSpan.current = colSpan;

  const filterColumns = enableColumnFilters
    ? visibleLeaf.filter((c) => c.getCanFilter() && !(c.columnDef.meta as ColumnMeta | undefined)?.disableFilter)
    : [];

  const state = table.getState().pagination;
  const currentPageCount = serverSide ? (pageCount || 1) : table.getPageCount();
  const currentTotal = serverSide ? (total ?? 0) : table.getFilteredRowModel().rows.length;
  const from = currentTotal > 0 ? state.pageIndex * state.pageSize + 1 : 0;
  const to = currentTotal > 0 ? Math.min((state.pageIndex + 1) * state.pageSize, currentTotal) : 0;

  return (
    <div className="space-y-3">
      {/* ── Araç çubuğu ─────────────────────────────────────────────── */}
      {(toolbar || onExport || enableColumnVisibility) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>

          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={loading} className="gap-1.5">
              <RotateCcw className={cn('size-3.5', loading && 'animate-spin')} /> Yenile
            </Button>
          )}

          {enableColumnVisibility && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setColumnDialogOpen(true)}>
              <Columns3 className="size-3.5" /> Sütunlar
            </Button>
          )}

          {onExport && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-success/30 text-success hover:bg-success/10 hover:text-success"
              onClick={onExport}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
              Excel
            </Button>
          )}
        </div>
      )}

      {/* ── Tablo ───────────────────────────────────────────────────── */}
      <div className="relative overflow-x-auto rounded-xl border border-border bg-card scrollbar-thin">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
            <Loader2 className="size-5 animate-spin text-brand" />
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-border">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      style={{ width: meta?.width }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        'whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground',
                        meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : 'text-left',
                        canSort && 'cursor-pointer select-none hover:text-foreground',
                      )}
                    >
                      <div className={cn(
                        'flex items-center gap-1',
                        meta?.align === 'right' && 'justify-end',
                        meta?.align === 'center' && 'justify-center',
                      )}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          sorted === 'asc' ? <ArrowUp className="size-3 text-brand" />
                            : sorted === 'desc' ? <ArrowDown className="size-3 text-brand" />
                              : <ArrowUpDown className="size-3 opacity-30" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}

            {/* Sütun filtre satırı */}
            {filterColumns.length > 0 && (
              <tr className="border-b border-border bg-muted/20">
                {visibleLeaf.map((column) => {
                  const meta = column.columnDef.meta as ColumnMeta | undefined;
                  const canFilter = column.getCanFilter() && !meta?.disableFilter;

                  if (!canFilter) return <th key={`f-${column.id}`} className="px-2 py-1.5" />;

                  if (meta?.filterVariant === 'select') {
                    return (
                      <th key={`f-${column.id}`} className="px-2 py-1.5">
                        <select
                          value={(column.getFilterValue() as string) ?? ''}
                          onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                          className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs font-normal normal-case
                                     tracking-normal focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Tümü</option>
                          {(meta.filterOptions ?? []).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </th>
                    );
                  }

                  // Tarih filtresi: sunucu `whereDate` ile eşleştirir, metin yerine takvim kutusu
                  if (meta?.filterVariant === 'date') {
                    return (
                      <th key={`f-${column.id}`} className="px-2 py-1.5">
                        <input
                          type="date"
                          value={(column.getFilterValue() as string) ?? ''}
                          onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                          className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs font-normal normal-case
                                     tracking-normal focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </th>
                    );
                  }

                  return (
                    <th key={`f-${column.id}`} className="px-2 py-1.5">
                      <DebouncedInput
                        value={(column.getFilterValue() as string) ?? ''}
                        onChange={(v) => column.setFilterValue(v || undefined)}
                        placeholder={meta?.filterPlaceholder ?? 'Filtrele…'}
                      />
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>

          <tbody>
            {!loading && table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-14 text-center text-muted-foreground">
                  {error ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="font-medium text-destructive">Veriler yüklenemedi.</span>
                      {onRetry && (
                        <Button variant="outline" size="sm" onClick={onRetry}>Tekrar dene</Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm">{emptyText}</span>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-border transition-colors last:border-0 hover:bg-muted/30',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ColumnMeta | undefined;

                    return (
                      <td
                        key={cell.id}
                        // Düzenlenebilir hücrelerde satır tıklamasını engelle
                        onClick={(e) => { if (meta?.skipExport) e.stopPropagation(); }}
                        className={cn(
                          'px-3 py-2 align-middle',
                          meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : '',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Alt bilgi / sayfalama ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {currentTotal ? `${from}–${to} / ${currentTotal.toLocaleString('tr-TR')} kayıt` : '0 kayıt'}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Sayfa başına</span>
            <select
              value={state.pageSize}
              onChange={(e) => table.setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
              className="h-8 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8"
            onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8"
            onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="whitespace-nowrap px-2 text-xs text-muted-foreground">
            {currentPageCount === 0 ? '0 / 0' : `${state.pageIndex + 1} / ${currentPageCount}`}
          </span>
          <Button variant="outline" size="icon" className="size-8"
            onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8"
            onClick={() => table.setPageIndex(currentPageCount - 1)} disabled={!table.getCanNextPage()}>
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* ── Sütun göster/gizle ──────────────────────────────────────── */}
      {enableColumnVisibility && (
        <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
          <DialogContent className="max-w-xs">
            <DialogHeader><DialogTitle>Sütunları Göster / Gizle</DialogTitle></DialogHeader>
            <div className="max-h-80 space-y-1.5 overflow-y-auto pt-1">
              {table.getAllLeafColumns().map((column) => {
                const meta = column.columnDef.meta as ColumnMeta | undefined;
                const header = column.columnDef.header;
                const label = meta?.exportHeader
                  ?? (typeof header === 'string' && header ? header : column.id);

                return (
                  <label key={column.id} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="rounded border-input accent-brand"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
