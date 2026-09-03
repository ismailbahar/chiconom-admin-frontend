import { Badge } from '@/components/ui/badge';

type Variant = 'default' | 'deal' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' | 'soft';

/**
 * Durum kodlarını renkli rozete çevirir.
 *
 * Panelin her yerinde aynı durum aynı renkte görünsün diye tek yerde
 * toplanmıştır: yeşil = tamamlandı/olumlu, turuncu = beklemede,
 * kırmızı = olumsuz, mor (marka) = akışta ilerleyen.
 */
const MAP: Record<string, { label: string; variant: Variant }> = {
  // Ürün
  draft:   { label: 'Taslak',  variant: 'secondary' },
  active:  { label: 'Yayında', variant: 'success' },
  passive: { label: 'Pasif',   variant: 'secondary' },

  // Sipariş akışı
  pending:            { label: 'Ödeme Bekleniyor', variant: 'warning' },
  paid:               { label: 'Ödeme Alındı',     variant: 'success' },
  processing:         { label: 'Hazırlanıyor',     variant: 'deal' },
  shipped:            { label: 'Kargoda',          variant: 'default' },
  delivered:          { label: 'Teslim Edildi',    variant: 'success' },
  completed:          { label: 'Tamamlandı',       variant: 'success' },
  cancelled:          { label: 'İptal',            variant: 'destructive' },
  refunded:           { label: 'İade Edildi',      variant: 'destructive' },
  partially_refunded: { label: 'Kısmi İade',       variant: 'warning' },
  failed:             { label: 'Başarısız',        variant: 'destructive' },

  // Ödeme
  unpaid:  { label: 'Ödenmedi', variant: 'warning' },
  success: { label: 'Başarılı', variant: 'success' },

  // Kargo gönderisi
  created:    { label: 'Oluşturuldu',  variant: 'secondary' },
  in_transit: { label: 'Yolda',        variant: 'default' },
  returned:   { label: 'İade Döndü',   variant: 'destructive' },

  // Talepler (iptal / iade / soru / yorum)
  requested:    { label: 'Talep Alındı',    variant: 'warning' },
  reviewing:    { label: 'İnceleniyor',     variant: 'warning' },
  approved:     { label: 'Onaylandı',       variant: 'success' },
  rejected:     { label: 'Reddedildi',      variant: 'destructive' },
  shipped_back: { label: 'Kargoya Verildi', variant: 'default' },
  received:     { label: 'Teslim Alındı',   variant: 'default' },
  withdrawn:    { label: 'Geri Çekildi',    variant: 'secondary' },
  new:          { label: 'Yeni',            variant: 'deal' },
  read:         { label: 'Okundu',          variant: 'secondary' },
  replied:      { label: 'Yanıtlandı',      variant: 'success' },
  answered:     { label: 'Cevaplandı',      variant: 'deal' },
  open:         { label: 'Açık',            variant: 'deal' },
  closed:       { label: 'Kapatıldı',       variant: 'secondary' },

  // Fatura
  issued: { label: 'Kesildi',    variant: 'success' },
  sent:   { label: 'Gönderildi', variant: 'success' },
  queued: { label: 'Kuyrukta',   variant: 'secondary' },
  error:  { label: 'Hata',       variant: 'destructive' },
  manual: { label: 'Manuel PDF', variant: 'soft' },
  auto:   { label: 'e-Fatura',   variant: 'soft' },

  // Kampanya
  paused: { label: 'Duraklatıldı', variant: 'warning' },
  ended:  { label: 'Sona Erdi',    variant: 'secondary' },
};

export default function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Sunucudan gelen hazır etiket varsa haritanın önüne geçer. */
  label?: string;
  className?: string;
}) {
  const entry = MAP[status];

  return (
    <Badge variant={entry?.variant ?? 'secondary'} className={className}>
      {label ?? entry?.label ?? status}
    </Badge>
  );
}

/** Filtre açılır listelerinde kullanmak için seçenek üretir. */
export function statusOptions(keys: string[]): Array<{ label: string; value: string }> {
  return keys.map((key) => ({ value: key, label: MAP[key]?.label ?? key }));
}

/** Sipariş akışındaki durumlar — sunucudaki `Order::FLOW` ile aynı sırada. */
export const ORDER_FLOW = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'completed'] as const;

/** Kapanmış sipariş durumları — `Order::CLOSED`. */
export const ORDER_CLOSED = ['cancelled', 'refunded', 'partially_refunded', 'failed'] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  [...ORDER_FLOW, ...ORDER_CLOSED].map((s) => [s, MAP[s].label]),
);
