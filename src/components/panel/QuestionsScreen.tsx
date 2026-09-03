import { useEffect, useMemo, useState } from 'react';
import type { AxiosInstance } from 'axios';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, ExternalLink, Loader2, MessageCircleQuestion, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import StatusBadge, { statusOptions } from '@/components/panel/StatusBadge';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import SmartImage from '@/components/SmartImage';
import { useServerTable } from '@/hooks/useServerTable';
import { STORE_URL } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatDateTime } from '@/lib/utils';

interface Row {
  id: number;
  product: string | null;
  product_slug: string | null;
  product_image: string | null;
  asker: string;
  asker_email: string | null;
  question: string;
  answer: string | null;
  status: string;
  is_public: boolean;
  answered_at: string | null;
  created_at: string;
}

const TABS = [
  { value: 'pending', label: 'Cevap Bekleyen' },
  { value: 'answered', label: 'Cevaplandı (yayımlanmadı)' },
  { value: 'approved', label: 'Yayında' },
  { value: 'rejected', label: 'Reddedilen' },
  { value: '', label: 'Tümü' },
];

/**
 * ÜRÜN SORULARI.
 *
 * Müşteri ürün sayfasından sorar; yönetici cevaplar. Cevap varsayılan olarak
 * hemen yayımlanır ve soran kişiye e-posta gider. İstenirse "yayımlamadan
 * kaydet" ile cevap taslak bırakılır.
 */
export default function QuestionsScreen({ client }: { client: AxiosInstance; scope?: string }) {
  const [status, setStatus] = useState('pending');
  const [active, setActive] = useState<Row | null>(null);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Ürün Soruları — Chiconom Yönetim';
  }, []);

  useEffect(() => {
    if (active) setAnswer(active.answer ?? '');
  }, [active]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: 'product',
      header: 'Ürün',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
            <SmartImage src={row.original.product_image} alt={row.original.product ?? ''} imgClassName="object-contain p-1" />
          </div>
          <p className="line-clamp-1 text-sm font-medium">{row.original.product ?? '—'}</p>
        </div>
      ),
      meta: { exportHeader: 'Ürün', filterPlaceholder: 'Ürün ara…' },
    },
    {
      accessorKey: 'question',
      header: 'Soru',
      cell: ({ row }) => (
        <div className="max-w-[380px]">
          <p className="line-clamp-2 text-sm">{row.original.question}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {row.original.asker} · {formatDateTime(row.original.created_at)}
          </p>
        </div>
      ),
      meta: { exportHeader: 'Soru', filterPlaceholder: 'Soru içinde ara…' },
    },
    {
      accessorKey: 'answer',
      header: 'Cevap',
      cell: ({ row }) => (
        row.original.answer
          ? <p className="line-clamp-2 max-w-[280px] text-xs text-muted-foreground">{row.original.answer}</p>
          : <Badge variant="warning">Cevap bekliyor</Badge>
      ),
      meta: { exportHeader: 'Cevap', filterPlaceholder: 'Cevap içinde ara…' },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      meta: {
        exportHeader: 'Durum',
        filterVariant: 'select',
        filterOptions: statusOptions(['pending', 'answered', 'approved', 'rejected']),
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Tarih',
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.original.created_at)}</span>,
      meta: { exportHeader: 'Tarih', exportFormat: 'datetime', filterPlaceholder: 'YYYY-AA-GG' },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" onClick={() => setActive(row.original)}>
            {row.original.answer ? 'Düzenle' : 'Cevapla'}
          </Button>
          {row.original.answer && row.original.status !== 'approved' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-success"
              title="Hızlı yayımla"
              onClick={async () => {
                try {
                  const { data } = await client.patch(`/questions/${row.original.id}`, { status: 'approved' });
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
  ], []);

  const table = useServerTable<Row>({
    api: client,
    endpoint: '/questions',
    columns,
    extraParams: { status },
    exportFilename: 'urun-sorulari',
  });

  const submitAnswer = async (publish: boolean) => {
    if (!active || answer.trim().length < 2) {
      toast.error('Cevap yazın.');
      return;
    }

    setSaving(true);

    try {
      const { data } = await client.post(`/questions/${active.id}/answer`, { answer: answer.trim(), publish });
      toast.success(data.message);
      setActive(null);
      table.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const moderate = async (next: 'rejected' | 'pending') => {
    if (!active) return;

    setSaving(true);

    try {
      const { data } = await client.patch(`/questions/${active.id}`, { status: next });
      toast.success(data.message);
      setActive(null);
      table.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Ürün Soruları"
        description="Müşterilerin ürün sayfasından sorduğu sorular. Cevabınız yayımlanır ve soran kişiye e-posta ile iletilir."
        icon={MessageCircleQuestion}
      />

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText="Bu durumda soru yok."
        toolbar={
          <div className="flex flex-wrap rounded-lg border border-border bg-card p-0.5">
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

      <Dialog open={active !== null} onOpenChange={(open) => { if (!open && !saving) setActive(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Soruyu Cevapla</DialogTitle>
            <DialogDescription>Cevap ürün sayfasında herkese görünür; soran kişiye e-posta gider.</DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-border p-3">
                <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
                  <SmartImage src={active.product_image} alt={active.product ?? ''} imgClassName="object-contain p-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{active.product}</p>
                  {active.product_slug && (
                    <a
                      href={`${STORE_URL}/urun/${active.product_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                    >
                      Ürünü gör <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                <StatusBadge status={active.status} />
              </div>

              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[11px] font-bold text-muted-foreground">SORU</p>
                <p className="mt-1 text-sm">{active.question}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {active.asker}{active.asker_email ? ` · ${active.asker_email}` : ''} · {formatDateTime(active.created_at)}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Cevap <span className="text-destructive">*</span>
                </label>
                <textarea
                  autoFocus
                  rows={5}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={2000}
                  placeholder="Müşteriye net ve kısa bir cevap yazın…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap">
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => { setDeleteId(active?.id ?? null); setActive(null); }}
            >
              <Trash2 className="size-4" /> Sil
            </Button>

            <Button variant="outline" onClick={() => setActive(null)} disabled={saving}>Vazgeç</Button>

            {active?.status !== 'rejected' && (
              <Button variant="outline" onClick={() => moderate('rejected')} disabled={saving}>
                <X className="size-4" /> Reddet
              </Button>
            )}

            <Button variant="outline" onClick={() => submitAnswer(false)} disabled={saving || answer.trim().length < 2}>
              Yayımlamadan Kaydet
            </Button>

            <Button variant="deal" onClick={() => submitAnswer(true)} disabled={saving || answer.trim().length < 2}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Cevapla ve Yayımla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Soruyu sil"
        description="Soru ve cevabı kalıcı olarak silinir."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          await client.delete(`/questions/${deleteId}`);
          if (deleteId) table.removeRow(deleteId);
        }}
        successMessage="Soru silindi."
      />
    </div>
  );
}
