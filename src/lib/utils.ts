import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1234.5 → "1.234,50 ₺" */
export function formatPrice(value: number | string | null | undefined, currency = '₺'): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** 1234.5 → "1.235" (kuruşsuz, kart üzerinde yer kazanmak için) */
export function formatPriceShort(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

export function formatNumber(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString('tr-TR');
}

/** ISO tarih → "16 Ağu 2026" */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** ISO tarih → "16 Ağu 2026 14:32" */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Kalan süreyi gün/saat/dakika/saniye olarak parçalar.
 * Kampanya geri sayım sayacının tek hesap noktası.
 */
export function splitDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    total: s,
  };
}

/** İki basamaklı, baştaki sıfır korunur: 7 → "07" */
export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Marka renginden türetilen, ada göre sabit bir degrade (görselsiz kartlar için) */
export function placeholderGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 40; // turuncu-kırmızı bandında kal
  return `linear-gradient(135deg, hsl(${20 + hue} 90% 62%), hsl(${8 + hue} 85% 50%))`;
}

export function slugify(text: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return text
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
