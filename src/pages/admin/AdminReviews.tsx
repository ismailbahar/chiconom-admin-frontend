import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Check, ImageIcon, Loader2, MessageSquare, Reply, Star, Trash2, X, ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import StatusBadge, { statusOptions } from '@/components/panel/StatusBadge';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import SmartImage from '@/components/SmartImage';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatDateTime } from '@/lib/utils';

interface Row {
  id: number;
  product: string | null;
  product_slug: string | null;
  product_image: string | null;
  author: string;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  reply: string | null;
  image_count: number;
  created_at: string;
}

interface ReviewImage {
  id: number;
  url: string;
  thumb: string | null;
  status: string;
  reject_reason: string | null;
  width: number | null;
  height: number | null;
}

interface Detail {
  id: number;
  rating: number;
  title: string | null;
  comment: string;
  usage_period: string | null;
  author: string;
  status: string;
  reject_reason: string | null;
  is_verified_purchase: boolean;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  product: { id: number; name: string; slug: string; cover_image: string | null } | null;
  customer: { id: number; first_name: string; last_name: string; email: string } | null;
  images: ReviewImage[];
}

const TABS = [
  { value: 'pending', label: 'Onay Bekleyen' },
  { value: 'approved', label: 'Yayında' },
  { value: 'rejected', label: 'Reddedilen' },
  { value: '', label: 'Tümü' },
];

/** Yıldız gösterimi. */
function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <span className="flex items-center gap-0.5" title={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            size === 'lg' ? 'size-5' : 'size-3.5',
            n <= value ? 'fill-warning text-warning' : 'text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

/**
 * DEĞERLENDİRME MODERASYONU.
 *
 * Yorum metni ve HER FOTOĞRAF ayrı onaylanır. Mağaza yoruma cevap yazabilir;
 * cevap anında ürün sayfasında "Mağaza yanıtı" olarak görünür.
 */
export default function AdminReviews() {
  const [status, setStatus] = useState('pending');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    document.title = 'Değerlendirmeler — Chiconom Yönetim';
  }, []);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'product',
      header: 'Ürün',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
            <SmartImage src={row.original.product_image} alt={row.original.product ?? 'Ürün'} imgClassName="object-contain p-1" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-medium">{row.original.product ?? '—'}</p>
            {row.original.image_count > 0 && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><ImageIcon className="size-3" /> {row.original.image_count} fotoğraf</p>
            )}
          </div>
        </div>
      ),
      meta: { exportHeader: 'Ürün', filterPlaceholder: 'Ürün ara…' },
    },
    {
      accessorKey: 'rating',
      header: 'Puan',
      cell: ({ row }) => <Stars value={row.original.rating} />,
      meta: {
        exportHeader: 'Puan', exportFormat: 'number',
        filterVariant: 'select', filterOptions: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} yıldız` })),
      },
    },
    {
      accessorKey: 'comment',
      header: 'Yorum',
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[340px]">
          {row.original.title && <p className="truncate text-sm font-medium">{row.original.title}</p>}
          <p className="line-clamp-2 text-xs text-muted-foreground">{row.original.comment}</p>
          {row.original.reply && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-brand"><Reply className="size-3" /> Yanıtlandı</p>
          )}
        </div>
      ),
      meta: { exportHeader: 'Yorum', filterPlaceholder: 'Yorum içinde ara…' },
    },
    {
      accessorKey: 'author',
      header: 'Yazan',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.author}</p>
          {row.original.is_verified_purchase && (
            <Badge variant="success" className="mt-0.5 text-[10px]">Doğrulanmış Alışveriş</Badge>
          )}
        </div>
      ),
      meta: { exportHeader: 'Yazan', disableFilter: true },
      enableSorting: false,
    },
    {
      accessorKey: 'created_at',
      header: 'Tarih',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.original.created_at)}</span>,
      meta: { exportHeader: 'Tarih', exportFormat: 'datetime', filterPlaceholder: 'YYYY-AA-GG' },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      meta: {
        exportHeader: 'Durum',
        filterVariant: 'select',
        filterOptions: statusOptions(['pending', 'approved', 'rejected']),
        disableFilter: Boolean(status),
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => setDetailId(row.original.id)}>
            İncele
          </Button>
          {row.original.status !== 'approved' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-success"
              title="Hızlı onayla"
              onClick={async () => {
                try {
                  const { data } = await adminApi.patch(`/reviews/${row.original.id}`, { status: 'approved' });
                  toast.success(data.message);
                  table.patchRow(row.original.id, { status: 'approved' });
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <Check className="size-4" />
            </Button>
          )}
        </div>
      ),
      meta: { skipExport: true, disableFilter: true, align: 'right' },
      enableSorting: false,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [status]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: '/reviews',
    columns,
    extraParams: { status },
    exportFilename: 'degerlendirmeler',
  });

  const { data: detail, isLoading: detailLoading, refetch: refetchDetail } = useQuery<Detail>({
    queryKey: ['admin-review', detailId],
    queryFn: async () => (await adminApi.get(`/reviews/${detailId}`)).data.data,
    enabled: detailId !== null,
  });

  useEffect(() => {
    setReply(detail?.reply ?? '');
  }, [detail?.id, detail?.reply]);

  const decide = async (next: 'approved' | 'rejected' | 'pending', reason?: string) => {
    if (!detailId) return;

    setBusy(true);

    try {
      const { data } = await adminApi.patch(`/reviews/${detailId}`, { status: next, reject_reason: reason ?? null });
      toast.success(data.message);
      table.patchRow(detailId, { status: next });
      refetchDetail();

      if (next !== 'pending') setDetailId(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!detailId) return;

    setReplying(true);

    try {
      const { data } = await adminApi.post(`/reviews/${detailId}/reply`, { reply: reply.trim() || null });
      toast.success(data.message);
      table.patchRow(detailId, { reply: reply.trim() || null });
      refetchDetail();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setReplying(false);
    }
  };

  const moderateImage = async (image: ReviewImage, next: 'approved' | 'rejected') => {
    try {
      const { data } = await adminApi.patch(`/review-images/${image.id}`, { status: next });
      toast.success(data.message);
      refetchDetail();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Değerlendirmeler"
        description="Yorum metni ve her fotoğraf ayrı ayrı onaylanır. Yoruma mağaza adına cevap yazabilirsiniz."
        icon={MessageSquare}
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Bu durumda değerlendirme yok."
        toolbar={
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
        }
      />

      {/* ── Detay ─────────────────────────────────────────────────── */}
      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Değerlendirme İncelemesi</DialogTitle>
            <DialogDescription>
              Metni ve fotoğrafları tek tek değerlendirin. Reddederken gerekçe yazarsanız müşteriye iletilir.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
                  <SmartImage src={detail.product?.cover_image} alt={detail.product?.name ?? 'Ürün'} imgClassName="object-contain p-1" />
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-1 font-medium">{detail.product?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(detail.created_at)}</p>
                </div>
                <StatusBadge status={detail.status} className="ml-auto" />
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Stars value={detail.rating} size="lg" />
                  {detail.is_verified_purchase && <Badge variant="success">Doğrulanmış Alışveriş</Badge>}
                  {detail.usage_period && <Badge variant="outline">Kullanım: {detail.usage_period}</Badge>}
                </div>

                {detail.title && <p className="text-base font-bold">{detail.title}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{detail.comment}</p>

                <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                  {detail.author}
                  {detail.customer ? ` · ${detail.customer.email}` : ''}
                </p>

                {detail.reject_reason && (
                  <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                    Red gerekçesi: {detail.reject_reason}
                  </p>
                )}
              </div>

              {/* Mağaza yanıtı */}
              <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-bold"><Reply className="size-4 text-brand" /> Mağaza yanıtı</p>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Müşteriye teşekkür edin veya sorununa çözüm önerin. Ürün sayfasında herkese görünür."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {detail.replied_at ? `Son yanıt: ${formatDateTime(detail.replied_at)}` : 'Henüz yanıtlanmadı'}
                  </span>
                  <Button size="sm" variant="deal" onClick={sendReply} disabled={replying}>
                    {replying ? <Loader2 className="size-3.5 animate-spin" /> : <Reply className="size-3.5" />}
                    {reply.trim() ? 'Yanıtı Yayımla' : detail.reply ? 'Yanıtı Kaldır' : 'Yanıtla'}
                  </Button>
                </div>
              </div>

              {/* Fotoğraflar */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <ImageIcon className="size-4 text-brand" />
                  Fotoğraflar ({detail.images.length})
                </p>

                {detail.images.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Bu değerlendirmeye fotoğraf eklenmemiş.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {detail.images.map((img) => (
                      <div key={img.id} className="overflow-hidden rounded-xl border border-border">
                        <button
                          type="button"
                          onClick={() => setLightbox(img.url)}
                          className="group relative block aspect-square w-full bg-secondary/40"
                        >
                          <SmartImage src={img.thumb ?? img.url} alt="Yorum fotoğrafı" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                            <ZoomIn className="size-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                          </span>
                          <StatusBadge status={img.status} className="absolute left-1.5 top-1.5" />
                        </button>

                        <div className="flex gap-1 p-1.5">
                          <Button variant={img.status === 'approved' ? 'deal' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => moderateImage(img, 'approved')}>
                            <Check className="size-3.5" /> Onayla
                          </Button>
                          <Button variant={img.status === 'rejected' ? 'destructive' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => moderateImage(img, 'rejected')}>
                            <X className="size-3.5" /> Kaldır
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button variant="deal" onClick={() => decide('approved')} disabled={busy || detail.status === 'approved'}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  <Check className="size-4" /> Yorumu Onayla
                </Button>
                <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
                  <X className="size-4" /> Reddet
                </Button>
                {detail.status !== 'pending' && (
                  <Button variant="outline" onClick={() => decide('pending')} disabled={busy}>
                    Beklemeye Al
                  </Button>
                )}
                <Button variant="ghost" className="ml-auto text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4" /> Sil
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => { if (!open) setLightbox(null); }}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Fotoğraf önizleme</DialogTitle>
          </DialogHeader>
          {lightbox && <img src={lightbox} alt="Yorum fotoğrafı" className="max-h-[80vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Değerlendirmeyi reddet"
        description="Yorum vitrinde görünmez. Gerekçe müşteriye iletilir."
        variant="destructive"
        confirmLabel="Reddet"
        requireReason
        reasonLabel="Red gerekçesi"
        onConfirm={async (reason) => { await decide('rejected', reason); }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Değerlendirmeyi kalıcı olarak sil"
        description="Yorum ve fotoğrafları silinir, ürün puanı yeniden hesaplanır. Geri alınamaz."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          await adminApi.delete(`/reviews/${detailId}`);
          if (detailId) table.removeRow(detailId);
          setDetailId(null);
        }}
        successMessage="Değerlendirme silindi."
      />
    </div>
  );
}
