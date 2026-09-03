import * as XLSX from 'xlsx';
import type { ColumnDef } from '@tanstack/react-table';

/**
 * Tablo sütunlarına iliştirilen ek bilgiler.
 * TanStack Table'ın `meta` alanı üzerinden taşınır.
 */
export interface ColumnMeta {
  /** Excel başlığı — sütun başlığı JSX ise bu kullanılır. */
  exportHeader?: string;
  /** Dışa aktarımda bu sütunu atla (işlem butonları, görseller). */
  skipExport?: boolean;
  /** Excel hücresini biçimlendir. */
  exportFormat?: 'currency' | 'date' | 'datetime' | 'boolean' | 'number';
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  /** Sunucu bu sütunda filtre desteklemiyorsa (hesaplanan/işlem sütunları) kapatılır. */
  disableFilter?: boolean;
  /** 'date' → sunucudaki `op: 'date'` filtresi için takvim kutusu (YYYY-AA-GG gönderir). */
  filterVariant?: 'text' | 'select' | 'date';
  filterOptions?: Array<{ label: string; value: string }>;
  filterPlaceholder?: string;
}

/** Sunucudaki `op: 'boolean'` filtreleri için hazır seçenekler (1/0 gönderilir). */
export const BOOLEAN_FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Evet', value: '1' },
  { label: 'Hayır', value: '0' },
];

/** Hücre değerini Excel'e uygun biçime çevirir. */
function formatValue(value: unknown, format?: ColumnMeta['exportFormat']): string | number {
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'currency':
      return Number(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return value ? 'Evet' : 'Hayır';
    case 'date':
      return value ? new Date(String(value)).toLocaleDateString('tr-TR') : '';
    case 'datetime':
      return value ? new Date(String(value)).toLocaleString('tr-TR') : '';
    default:
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
  }
}

/**
 * Tablo verisini Excel dosyası olarak indirir.
 *
 * Sütun tanımları (ColumnDef) kullanıldığı için Excel çıktısı ekranda
 * görünen tabloyla aynı sırayı ve başlıkları taşır — kullanıcı "ekranda
 * gördüğümü indirdim" hissini kaybetmez.
 */
export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  columns: ColumnDef<T, unknown>[],
  fileName: string,
  sheetName = 'Veri',
): void {
  const exportable = columns.filter((column) => {
    const meta = column.meta as ColumnMeta | undefined;
    return !meta?.skipExport && (column as { accessorKey?: string }).accessorKey;
  });

  const headers = exportable.map((column) => {
    const meta = column.meta as ColumnMeta | undefined;
    if (meta?.exportHeader) return meta.exportHeader;
    return typeof column.header === 'string'
      ? column.header
      : (column as { accessorKey?: string }).accessorKey ?? '';
  });

  const body = rows.map((row) =>
    exportable.map((column) => {
      const key = (column as { accessorKey?: string }).accessorKey as keyof T;
      const meta = column.meta as ColumnMeta | undefined;
      return formatValue(row[key], meta?.exportFormat);
    }),
  );

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);

  // Sütun genişliklerini başlık ve içeriğe göre otomatik ayarla
  sheet['!cols'] = headers.map((header, i) => ({
    wch: Math.min(
      45,
      Math.max(
        header.length + 2,
        ...body.slice(0, 200).map((row) => String(row[i] ?? '').length + 2),
      ),
    ),
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, fileName);
}

/** Ham veriyi (sütun tanımı olmadan) Excel'e aktarır. */
export function exportRawToExcel(
  rows: Array<Record<string, unknown>>,
  fileName: string,
  sheetName = 'Veri',
): void {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, fileName);
}
