import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ColumnDef, ColumnFiltersState, PaginationState, SortingState, Updater, VisibilityState,
} from '@tanstack/react-table';
import type { AxiosInstance } from 'axios';
import { exportToExcel } from '@/lib/exportExcel';

export interface ServerTableMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

interface Options<TData> {
  /** API istemcisi — panelde tek istemci vardır (adminApi), test edilebilirlik için dışarıdan verilir */
  api: AxiosInstance;
  /** Uç nokta yolu, örn. '/products' */
  endpoint: string;
  /** Excel dışa aktarımı için sütun tanımları */
  columns: ColumnDef<TData, unknown>[];
  initialSorting?: SortingState;
  initialPageSize?: number;
  initialColumnVisibility?: VisibilityState;
  /** Ekrana özel ek parametreler (durum sekmesi, tarih aralığı, arama) */
  extraParams?: Record<string, string | number | boolean | undefined | null>;
  exportFilename?: string;
  enabled?: boolean;
}

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
}

/**
 * Sunucu taraflı tablo durumu.
 *
 * Backend'deki `ServerTableQuery` trait'iyle aynı sözleşmeyi konuşur:
 *   page, per_page, sort_by, sort_direction, filter_<sütun>, export
 *
 * Yarış koşulu koruması: her istek numaralanır, yalnız SON isteğin yanıtı
 * ekrana yazılır. Hızlı yazılan filtrelerde eski yanıtın yeniyi ezmesi engellenir.
 */
export function useServerTable<TData>({
  api,
  endpoint,
  columns,
  initialSorting = [{ id: 'id', desc: true }],
  initialPageSize = 20,
  initialColumnVisibility = {},
  extraParams = {},
  exportFilename = 'tablo',
  enabled = true,
}: Options<TData>) {
  const [data, setData] = useState<TData[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: initialPageSize });
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility);

  const extraKey = JSON.stringify(extraParams ?? {});
  const sortKey = JSON.stringify(sorting);
  const filterKey = JSON.stringify(columnFilters);
  const requestId = useRef(0);
  const firstRender = useRef(true);

  const buildParams = useCallback(
    (options?: { export?: boolean }) => {
      const params: Record<string, string | number | boolean> = {};

      if (options?.export) {
        params.export = 1;
      } else {
        params.page = pagination.pageIndex + 1;
        params.per_page = pagination.pageSize;
      }

      const sort = sorting[0];
      if (sort) {
        params.sort_by = sort.id;
        params.sort_direction = sort.desc ? 'desc' : 'asc';
      }

      columnFilters.forEach((filter) => {
        if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
          params[`filter_${filter.id}`] = filter.value as string;
        }
      });

      Object.entries(extraParams ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params[key] = value;
      });

      return params;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagination.pageIndex, pagination.pageSize, sortKey, filterKey, extraKey],
  );

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const id = ++requestId.current;
    setLoading(true);

    try {
      const { data: response } = await api.get(endpoint, { params: buildParams() });

      if (id !== requestId.current) return;  // Eski yanıt — yoksay

      const meta: ServerTableMeta = response.meta ?? {};
      setData(response.data ?? []);
      setPageCount(meta.last_page ?? 1);
      setTotal(meta.total ?? (response.data?.length ?? 0));
      setError(false);
    } catch {
      if (id === requestId.current) {
        // Hatayı yutmuyoruz: "kayıt yok" yerine "yüklenemedi" gösterilir
        setData([]);
        setPageCount(1);
        setTotal(0);
        setError(true);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [api, endpoint, buildParams, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtre/sıralama değişince ilk sayfaya dön (ilk render hariç)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, filterKey, extraKey]);

  const exportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const { data: response } = await api.get(endpoint, { params: buildParams({ export: true }) });
      const stamp = new Date().toISOString().slice(0, 10);
      exportToExcel(response.data ?? [], columns as never, `${exportFilename}-${stamp}.xlsx`);
    } catch {
      /* Hata durumu `exporting` bayrağıyla çağırana bildirilir */
    } finally {
      setExporting(false);
    }
  }, [api, endpoint, buildParams, columns, exportFilename]);

  /**
   * Satır içi düzenleme sonrası: sunucuya tekrar gitmeden tek satırı tazeler.
   * Switch/kalem düzenlemelerinde tablo zıplamasın diye kullanılır.
   */
  const patchRow = useCallback((id: number | string, changes: Partial<TData>) => {
    setData((rows) =>
      rows.map((row) =>
        (row as { id?: number | string }).id === id ? { ...row, ...changes } : row,
      ),
    );
  }, []);

  const removeRow = useCallback((id: number | string) => {
    setData((rows) => rows.filter((row) => (row as { id?: number | string }).id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  return {
    data, total, pageCount, loading, error, exporting,
    pagination, sorting, columnFilters, columnVisibility,
    setPagination, setSorting, setColumnFilters, setColumnVisibility,
    refresh: fetchData,
    exportExcel,
    patchRow,
    removeRow,

    /** Doğrudan <ServerTable {...tableProps} columns={columns} /> içine yayılır. */
    tableProps: {
      data, total, pageCount,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      loading, error, sorting, columnFilters, columnVisibility, exporting,
      onPaginationChange: (u: Updater<PaginationState>) => setPagination((p) => resolveUpdater(u, p)),
      onSortingChange: (u: Updater<SortingState>) => setSorting((p) => resolveUpdater(u, p)),
      onColumnFiltersChange: (u: Updater<ColumnFiltersState>) => setColumnFilters((p) => resolveUpdater(u, p)),
      onColumnVisibilityChange: (u: Updater<VisibilityState>) => setColumnVisibility((p) => resolveUpdater(u, p)),
      onExport: exportExcel,
      onRetry: fetchData,
    },
  };
}
