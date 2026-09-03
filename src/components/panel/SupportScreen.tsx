import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import {
  Lock, Loader2, MessageSquare, Plus, Send, Ticket, User,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import StatusBadge from '@/components/panel/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/apiError';
import { cn, formatDateTime } from '@/lib/utils';

interface TicketRow {
  id: number;
  code: string;
  subject: string;
  category: string;
  category_label: string;
  priority: string;
  status: string;
  opener: string;
  opener_type: string;
  assignee: string | null;
  message_count: number;
  last_reply_at: string | null;
  created_at: string;
}

interface Message {
  id: number;
  author_type: string;
  author_name: string;
  message: string;
  is_internal: boolean;
  created_at: string;
}

interface Detail {
  id: number;
  code: string;
  subject: string;
  category_label: string;
  priority: string;
  status: string;
  customer: { id: number; name: string; email: string } | null;
  order_number: string | null;
  assignee: string | null;
  created_at: string;
  closed_at: string | null;
  messages: Message[];
}

const CATEGORIES = [
  { value: 'order', label: 'Sipariş' },
  { value: 'payment', label: 'Ödeme' },
  { value: 'product', label: 'Ürün & Katalog' },
  { value: 'shipping', label: 'Kargo' },
  { value: 'return', label: 'İptal & İade' },
  { value: 'account', label: 'Hesap & Panel' },
  { value: 'technical', label: 'Teknik Sorun' },
  { value: 'other', label: 'Diğer' },
];

const PRIORITIES = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'urgent', label: 'Acil' },
];

const STATUS_TABS = [
  { value: '', label: 'Tümü' },
  { value: 'open', label: 'Açık' },
  { value: 'answered', label: 'Yanıtlandı' },
  { value: 'closed', label: 'Kapalı' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-muted-foreground',
  normal: 'text-foreground',
  high: 'text-warning',
  urgent: 'text-destructive',
};

interface Props {
  /** Hangi API istemcisi kullanılacak: adminApi veya api (müşteri) */
  client: AxiosInstance;
  basePath?: string;
  scope: 'admin' | 'customer';
}

/**
 * DESTEK TALEPLERİ — yönetim ve müşteri panelinde aynı bileşen.
 *
 * Farklar sunucuda çözülür (kapsam daraltma, iç not görünürlüğü); burada
 * yalnız YETKİYE BAĞLI ARAYÜZ farkları vardır:
 *   · yönetici → durum/öncelik değiştirebilir, İÇ NOT yazabilir
 *   · müşteri → talep açar, yanıtlar, kapatır
 */
export default function SupportScreen({ client, basePath = '/support', scope }: Props) {
  const isAdmin = scope === 'admin';

  const [status, setStatus] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({ subject: '', category: 'other', priority: 'normal', message: '' });

  useEffect(() => {
    document.title = 'Destek Talepleri';
  }, []);

  const { data, isLoading, refetch } = useQuery<{ data: TicketRow[] }>({
    queryKey: ['support-tickets', scope, status],
    queryFn: async () => (await client.get(basePath, { params: { status: status || undefined, per_page: 100 } })).data,
  });

  const { data: detail, isLoading: detailLoading, refetch: refetchDetail } = useQuery<{ data: Detail }>({
    queryKey: ['support-ticket', scope, activeId],
    queryFn: async () => (await client.get(`${basePath}/${activeId}`)).data,
    enabled: activeId !== null,
  });

  const tickets = data?.data ?? [];
  const ticket = detail?.data;

  // İlk talebi otomatik seç — boş bir sağ panel kimseye faydalı değil
  useEffect(() => {
    if (activeId === null && tickets.length > 0) setActiveId(tickets[0].id);
  }, [tickets, activeId]);

  const openCount = useMemo(
    () => tickets.filter((t) => t.status !== 'closed').length,
    [tickets],
  );

  const send = async () => {
    if (reply.trim().length < 2 || !activeId) return;

    setSending(true);

    try {
      const { data: res } = await client.post(`${basePath}/${activeId}/reply`, {
        message: reply.trim(),
        is_internal: internal,
      });

      toast.success(res.message);
      setReply('');
      setInternal(false);
      refetchDetail();
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const create = async () => {
    if (form.subject.trim().length < 3 || form.message.trim().length < 10) {
      toast.error('Konu ve mesaj alanlarını doldurun.');
      return;
    }

    setSending(true);

    try {
      const { data: res } = await client.post(basePath, form);
      toast.success(res.message);
      setCreateOpen(false);
      setForm({ subject: '', category: 'other', priority: 'normal', message: '' });
      refetch();
      setActiveId(res.data.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (next: string) => {
    if (!activeId) return;

    try {
      const { data: res } = await client.patch(`${basePath}/${activeId}`, { status: next });
      toast.success(res.message);
      refetchDetail();
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Destek Talepleri"
        description={isAdmin
          ? 'Mağaza ve müşteri taleplerini yanıtlayın. İç notlar talebi açana gösterilmez.'
          : 'Sorun ve sorularınız için talep açın; en kısa sürede dönüş yapılır.'}
        icon={Ticket}
        actions={
          <Button variant="deal" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Yeni Talep
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setActiveId(null); }}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              status === tab.value ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.value === '' && openCount > 0 && (
              <Badge variant="warning" className="ml-1.5 text-[10px]">{openCount} açık</Badge>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Talep listesi */}
        <aside className="max-h-[70vh] space-y-1.5 overflow-y-auto">
          {isLoading ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Loader2 className="size-5 animate-spin text-brand" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
              <MessageSquare className="mx-auto size-7 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">Bu durumda talep yok.</p>
            </div>
          ) : (
            tickets.map((row) => (
              <button
                key={row.id}
                onClick={() => setActiveId(row.id)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-colors',
                  activeId === row.id ? 'border-brand bg-brand-soft' : 'border-border bg-card hover:border-brand/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{row.code}</span>
                  <StatusBadge status={row.status} />
                </div>

                <p className="mt-1 line-clamp-1 text-sm font-medium">{row.subject}</p>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{row.category_label}</span>
                  <span className={PRIORITY_COLORS[row.priority]}>· {PRIORITIES.find((p) => p.value === row.priority)?.label}</span>
                  {isAdmin && <span>· {row.opener}</span>}
                  <span>· {row.message_count} mesaj</span>
                </div>

                {row.last_reply_at && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Son yanıt: {formatDateTime(row.last_reply_at)}
                  </p>
                )}
              </button>
            ))
          )}
        </aside>

        {/* Yazışma */}
        <div className="min-w-0 rounded-2xl border border-border bg-card">
          {!activeId ? (
            <p className="p-10 text-center text-sm text-muted-foreground">Soldan bir talep seçin.</p>
          ) : detailLoading || !ticket ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <p className="font-bold">{ticket.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{ticket.code}</span> · {ticket.category_label} ·{' '}
                    {formatDateTime(ticket.created_at)}
                    {ticket.order_number && <> · Sipariş: {ticket.order_number}</>}
                  </p>
                  {isAdmin && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Açan: {ticket.customer?.name ?? '—'}
                      {ticket.customer?.email ? ` (${ticket.customer.email})` : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={ticket.status} />
                  {isAdmin ? (
                    <select
                      value={ticket.status}
                      onChange={(e) => changeStatus(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="open">Açık</option>
                      <option value="pending">Beklemede</option>
                      <option value="answered">Yanıtlandı</option>
                      <option value="closed">Kapalı</option>
                    </select>
                  ) : ticket.status !== 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await client.post(`${basePath}/${activeId}/close`);
                        toast.success('Talep kapatıldı.');
                        refetchDetail();
                        refetch();
                      }}
                    >
                      Talebi Kapat
                    </Button>
                  )}
                </div>
              </div>

              {/* Mesajlar */}
              <div className="max-h-[45vh] space-y-3 overflow-y-auto p-4">
                {ticket.messages.map((message) => {
                  const mine = scope === 'admin'
                    ? message.author_type === 'admin'
                    : message.author_type !== 'admin';

                  return (
                    <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl p-3',
                          message.is_internal
                            ? 'border border-dashed border-warning bg-warning/10'
                            : mine
                              ? 'bg-brand text-white'
                              : 'bg-muted',
                        )}
                      >
                        <p className={cn(
                          'flex items-center gap-1.5 text-[11px] font-medium',
                          message.is_internal ? 'text-warning' : mine ? 'text-white/80' : 'text-muted-foreground',
                        )}>
                          {message.is_internal ? <Lock className="size-3" /> : <User className="size-3" />}
                          {message.author_name}
                          {message.is_internal && ' · İç Not (yalnız ekip görür)'}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{message.message}</p>
                        <p className={cn(
                          'mt-1 text-[10px]',
                          mine && !message.is_internal ? 'text-white/70' : 'text-muted-foreground',
                        )}>
                          {formatDateTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Yanıt kutusu */}
              {ticket.status !== 'closed' || isAdmin ? (
                <div className="border-t border-border p-3">
                  <textarea
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={internal ? 'İç not yazın (karşı taraf görmez)…' : 'Yanıtınızı yazın…'}
                    className={cn(
                      'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                      internal ? 'border-warning' : 'border-input',
                    )}
                  />

                  <div className="mt-2 flex items-center justify-between gap-2">
                    {isAdmin ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={internal}
                          onChange={(e) => setInternal(e.target.checked)}
                          className="size-3.5 accent-warning"
                        />
                        <Lock className="size-3" /> İç not olarak kaydet
                      </label>
                    ) : <span />}

                    <Button
                      variant="deal"
                      size="sm"
                      onClick={send}
                      disabled={sending || reply.trim().length < 2}
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      Gönder
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-border p-4 text-center text-xs text-muted-foreground">
                  Bu talep kapatılmıştır. Yeni bir konu için yeni talep açabilirsiniz.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Yeni talep */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!sending) setCreateOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Destek Talebi</DialogTitle>
            <DialogDescription>
              Konuyu net yazın; ilgili sipariş numarasını mesaja eklerseniz daha hızlı dönüş alırsınız.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Konu <span className="text-destructive">*</span></label>
              <Input
                autoFocus
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Örn. Hakediş ödemem gecikti"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Kategori</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Öncelik</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Mesaj <span className="text-destructive">*</span></label>
              <textarea
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Sorununuzu ayrıntılı anlatın…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={sending}>Vazgeç</Button>
            <Button variant="deal" onClick={create} disabled={sending}>
              {sending && <Loader2 className="size-4 animate-spin" />} Talebi Aç
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
