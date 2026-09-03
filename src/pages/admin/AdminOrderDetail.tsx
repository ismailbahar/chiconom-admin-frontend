import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Banknote, Check, CreditCard, Download, ExternalLink, FileText, Gift, Loader2,
  MapPin, Package, Receipt, RotateCcw, Search, Send, StickyNote, Truck, User, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import StatusBadge, { ORDER_FLOW, ORDER_STATUS_LABELS } from '@/components/panel/StatusBadge';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import ShipmentDialog from '@/components/panel/ShipmentDialog';
import InvoiceUploadDialog from '@/components/panel/InvoiceUploadDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SmartImage from '@/components/SmartImage';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { usePanelAuthStore } from '@/stores/panelAuthStore';
import { cn, formatDate, formatDateTime, formatPrice } from '@/lib/utils';

interface Address {
  title?: string;
  full_name?: string;
  phone?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
  address?: string;
  zip_code?: string;
  tax_office?: string;
  tax_number?: string;
  company_name?: string;
  identity_number?: string;
}

interface Item {
  id: number;
  product_id: number | null;
  product_slug: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  image: string | null;
  quantity: number;
  unit_price: number;
  list_price: number | null;
  line_total: number;
  tax_rate: number;
  status: string;
  refunded_quantity: number;
}

interface Shipment {
  id: number;
  tracking_number: string | null;
  status: string;
  status_label: string;
  company: string | null;
  company_code: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  events: Array<{ date?: string; status?: string; description?: string; location?: string }>;
  note: string | null;
}

interface Invoice {
  id: number;
  invoice_number: string | null;
  issue_date: string | null;
  total: number;
  status: string;
  source: 'manual' | 'auto';
  has_file: boolean;
  original_name: string | null;
  sent_to_customer_at: string | null;
  send_count: number;
  viewer_url: string | null;
}

interface Detail {
  order: Record<string, unknown> & {
    order_number: string;
    status: string;
    status_label: string;
    next_statuses: string[];
    is_cancellable: boolean;
    payment_status: string;
    grand_total: number | string;
    shipping_address: Address | null;
    billing_address: Address | null;
    created_at: string;
  };
  customer: { id: number; first_name: string; last_name: string; email: string; phone: string; order_count: number; total_spent: number } | null;
  items: Item[];
  shipments: Shipment[];
  invoice: Invoice | null;
  transactions: Array<{
    id: number; provider: string; type: string; amount: number | string; status: string;
    installment: number | null; card_mask: string | null; card_brand: string | null;
    card_bank: string | null; error_message: string | null; provider_transaction_id: string | null;
    created_at: string;
  }>;
  refunds: Array<{ id: number; amount: number; status: string; method: string; reason: string | null; note: string | null; error_message: string | null; completed_at: string | null; created_at: string }>;
  refundable: number;
  returns: Array<{ id: number; code: string; status: string; reason: string; refund_amount: number | string; created_at: string }>;
  cancellations: Array<{ id: number; code: string; status: string; reason: string; created_at: string }>;
  history: Array<{ id: number; from_status: string | null; to_status: string; note: string | null; actor_name: string | null; created_at: string }>;
}

/** Etiket + değer satırı. */
function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('text-right', strong && 'font-bold')}>{value}</span>
    </div>
  );
}

function AddressCard({ title, icon: Icon, address }: { title: string; icon: React.ElementType; address: Address | null }) {
  if (!address) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-brand" /> {title}</p>
        <p className="text-sm text-muted-foreground">Adres bilgisi yok.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-brand" /> {title}</p>
      <p className="text-sm font-medium">{address.full_name ?? address.company_name ?? '—'}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{address.phone}</p>
      <p className="mt-1.5 text-sm leading-relaxed">
        {address.address}
        {address.neighborhood ? `, ${address.neighborhood}` : ''}
      </p>
      <p className="text-sm text-muted-foreground">
        {[address.district, address.city, address.zip_code].filter(Boolean).join(' / ')}
      </p>
      {(address.tax_number || address.identity_number) && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
          {address.company_name && <>Ünvan: {address.company_name}<br /></>}
          {address.tax_office && <>VD: {address.tax_office} · </>}
          {address.tax_number ? `VKN: ${address.tax_number}` : `TCKN: ${address.identity_number}`}
        </p>
      )}
    </div>
  );
}

/**
 * Durum adımları — pending → paid → processing → shipped → delivered → completed.
 * Geçerli adım vurgulanır; kapanmış siparişte şerit kırmızıya döner.
 */
function StatusSteps({ status }: { status: string }) {
  const index = (ORDER_FLOW as readonly string[]).indexOf(status);
  const closed = index === -1;

  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {ORDER_FLOW.map((step, i) => (
        <li key={step} className="flex items-center gap-1">
          <span className={cn(
            'rounded-full px-2.5 py-1 font-medium',
            closed ? 'bg-muted text-muted-foreground line-through'
              : i < index ? 'bg-success/15 text-success'
                : i === index ? 'bg-brand text-white'
                  : 'bg-muted text-muted-foreground',
          )}>
            {i < index && !closed ? <Check className="mr-1 inline size-3" /> : null}
            {ORDER_STATUS_LABELS[step]}
          </span>
          {i < ORDER_FLOW.length - 1 && <ArrowRight className="size-3 text-muted-foreground/50" />}
        </li>
      ))}
      {closed && <li><StatusBadge status={status} /></li>}
    </ol>
  );
}

/**
 * SİPARİŞ DETAYI.
 *
 * Tek satıcılı mağaza: sipariş = tek paket. Durum şeridinden ilerletilir,
 * kargo eklenir, fatura PDF'i yüklenip müşteriye gönderilir, gerekirse iptal
 * ve para iadesi yapılır. Her işlem geçmişe düşer.
 */
export default function AdminOrderDetail() {
  const { orderNumber = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePanelAuthStore((s) => s.can);

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceDeleteOpen, setInvoiceDeleteOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [retrieving, setRetrieving] = useState<number | null>(null);
  const [trackingEdit, setTrackingEdit] = useState<{ id: number; value: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Detail>({
    queryKey: ['admin-order', orderNumber],
    queryFn: async () => (await adminApi.get(`/orders/${orderNumber}`)).data.data,
    enabled: Boolean(orderNumber),
  });

  useEffect(() => {
    document.title = `Sipariş ${orderNumber} — Chiconom Yönetim`;
  }, [orderNumber]);

  // Listeden "Kargoya Ver" ile gelindiyse (#kargo) kutuyu doğrudan aç
  useEffect(() => {
    if (location.hash === '#kargo' && data && data.order.next_statuses.includes('shipped')) {
      setShipOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, data?.order.order_number]);

  // Sunucudaki not ekrana yansır — boş olsa bile (silmeyi mümkün kılar)
  useEffect(() => {
    setNote(data?.order.admin_note ? String(data.order.admin_note) : '');
  }, [data?.order.admin_note]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Sipariş bulunamadı.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/siparisler')}>
          Sipariş listesine dön
        </Button>
      </div>
    );
  }

  const o = data.order;
  const paidTotal = data.transactions
    .filter((t) => t.type === 'payment' && t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const refundedTotal = data.transactions
    .filter((t) => t.type === 'refund' && t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const refundable = Number(data.refundable ?? Math.max(0, paidTotal - refundedTotal));
  const nextFlow = o.next_statuses.filter((s) => (ORDER_FLOW as readonly string[]).includes(s));
  const invoiceNeeded = !data.invoice && ['shipped', 'delivered', 'completed'].includes(o.status);

  const run = async (key: string, fn: () => Promise<{ data: { message?: string } }>) => {
    setBusy(key);

    try {
      const { data: res } = await fn();
      if (res.message) toast.success(res.message);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = (status: string) => {
    if (status === 'shipped' && data.shipments.length === 0) {
      setShipOpen(true);
      return;
    }

    return run(`status-${status}`, () => adminApi.patch(`/orders/${orderNumber}/status`, { status }));
  };

  const markPaid = () => run('paid', () => adminApi.post(`/orders/${orderNumber}/paid`));

  const saveNote = async () => {
    setSavingNote(true);

    try {
      const { data: res } = await adminApi.post(`/orders/${orderNumber}/note`, { note });
      toast.success(res.message);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingNote(false);
    }
  };

  const saveTracking = async () => {
    if (!trackingEdit) return;

    await run('tracking', () => adminApi.patch(`/shipments/${trackingEdit.id}`, { tracking_number: trackingEdit.value }));
    setTrackingEdit(null);
  };

  const sendInvoice = () => data.invoice && run('invoice-send', () => adminApi.post(`/invoices/${data.invoice!.id}/send`));

  const downloadInvoice = async () => {
    if (!data.invoice) return;

    try {
      const response = await adminApi.get(`/invoices/${data.invoice.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `Fatura-${data.invoice.invoice_number ?? data.invoice.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const retrieveTransaction = async (transactionId: number) => {
    setRetrieving(transactionId);

    try {
      const { data: res } = await adminApi.get(`/orders/${orderNumber}/transactions/${transactionId}/retrieve`);

      if (res.data?.mismatch) {
        toast.error(`UYUŞMAZLIK — bizde: ${res.data.local_status}, POS'ta: ${res.data.remote_status}`);
      } else {
        toast.success(res.message);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRetrieving(null);
    }
  };

  const sendRefund = async () => {
    const amount = Number(refundAmount);

    if (!amount || amount <= 0) {
      toast.error('İade tutarı girin.');
      return;
    }

    if (amount > refundable + 0.01) {
      toast.error(`En fazla ${formatPrice(refundable)} iade edilebilir.`);
      return;
    }

    setRefunding(true);

    try {
      const { data: res } = await adminApi.post(`/orders/${orderNumber}/refund`, { amount, note: refundNote || undefined });
      toast.success(res.message);
      setRefundOpen(false);
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Sipariş ${o.order_number}`}
        description={`${formatDateTime(o.created_at)} · ${data.items.length} kalem · ${String(o.customer_name ?? 'Misafir')}`}
        icon={Package}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> Geri
            </Button>

            {o.payment_status !== 'paid' && o.status === 'pending' && can('orders.manage') && (
              <Button variant="outline" size="sm" onClick={markPaid} disabled={busy === 'paid'}>
                {busy === 'paid' ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />} Ödendi İşaretle
              </Button>
            )}

            {can('refunds.manage') && refundable > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setRefundAmount(refundable.toFixed(2)); setRefundNote(''); setRefundOpen(true); }}>
                <RotateCcw className="size-4" /> Para İadesi
              </Button>
            )}

            {can('orders.manage') && o.is_cancellable && (
              <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                <XCircle className="size-4" /> İptal Et
              </Button>
            )}
          </>
        }
      />

      {/* ── Durum şeridi ve ilerletme ──────────────────────────────── */}
      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusSteps status={o.status} />

          {can('orders.manage') && nextFlow.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nextFlow.map((s) => (
                <Button
                  key={s}
                  variant={s === 'shipped' ? 'deal' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  disabled={busy === `status-${s}`}
                  onClick={() => changeStatus(s)}
                >
                  {busy === `status-${s}` ? <Loader2 className="size-3.5 animate-spin" /> : s === 'shipped' ? <Truck className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                  {s === 'shipped' && data.shipments.length === 0 ? 'Kargoya Ver' : `${ORDER_STATUS_LABELS[s]} Yap`}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <StatusBadge status={o.payment_status} />
          {Boolean(o.payment_method) && (
            <Badge variant="outline">
              {o.payment_method === 'card' ? 'Kredi Kartı' : o.payment_method === 'bank_transfer' ? 'Havale/EFT' : String(o.payment_method)}
              {o.payment_provider ? ` · ${String(o.payment_provider)}` : ''}
              {Number(o.installment) > 1 ? ` · ${o.installment} taksit` : ''}
            </Badge>
          )}
          {Boolean(o.coupon_code) && <Badge variant="deal">Kupon: {String(o.coupon_code)}</Badge>}
          {Boolean(o.invoice_type) && (
            <Badge variant="secondary">{o.invoice_type === 'corporate' ? 'Kurumsal Fatura' : 'Bireysel Fatura'}</Badge>
          )}
          {Boolean(o.is_gift) && <Badge variant="soft"><Gift className="mr-1 size-3" /> Hediye paketi</Badge>}
          {Boolean(o.cancel_reason) && (
            <span className="text-xs text-destructive">İptal gerekçesi: {String(o.cancel_reason)}</span>
          )}
        </div>
      </div>

      {Boolean(o.admin_note) && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="text-xs font-bold">Yönetici notu</p>
            <p className="mt-0.5 whitespace-pre-wrap">{String(o.admin_note)}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        {/* ── Sol: kalemler, kargo, fatura, ödemeler, geçmiş ─────────── */}
        <div className="min-w-0 space-y-4">
          {/* Kalemler */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
              <p className="text-sm font-bold">Ürünler ({data.items.length})</p>
              <p className="text-xs text-muted-foreground">Toplam {formatPrice(o.grand_total)}</p>
            </div>
            <div className="divide-y divide-border">
              {data.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
                    <SmartImage src={item.image} alt={item.product_name} imgClassName="object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {item.product_id ? (
                      <Link to={`/urunler/${item.product_id}`} className="line-clamp-2 text-sm font-medium hover:text-brand">
                        {item.product_name}
                      </Link>
                    ) : (
                      <p className="line-clamp-2 text-sm font-medium">{item.product_name}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {item.variant_name ? <span className="font-semibold text-foreground">{item.variant_name} · </span> : null}
                      {item.sku ?? '—'} · KDV %{item.tax_rate}
                    </p>
                    {item.refunded_quantity > 0 && (
                      <p className="text-[11px] text-destructive">{item.refunded_quantity} adet iade edildi</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">{formatPrice(item.line_total)}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{item.quantity} × {formatPrice(item.unit_price)}</p>
                    {item.list_price && Number(item.list_price) > Number(item.unit_price) && (
                      <p className="text-[11px] text-muted-foreground line-through tabular-nums">{formatPrice(item.list_price)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kargo */}
          <div id="kargo" className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-bold"><Truck className="size-4 text-brand" /> Kargo</p>
              {can('shipments.manage') && ['paid', 'processing', 'shipped', 'partially_refunded'].includes(o.status) && (
                <Button variant="outline" size="sm" onClick={() => setShipOpen(true)}>
                  <Truck className="size-3.5" /> {data.shipments.length ? 'Ek Gönderi' : 'Kargoya Ver'}
                </Button>
              )}
            </div>

            {data.shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz kargo gönderisi yok.</p>
            ) : (
              <div className="space-y-2">
                {data.shipments.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.company ?? 'Kargo'}</span>
                      <StatusBadge status={s.status} label={s.status_label} />
                      {trackingEdit?.id === s.id ? (
                        <span className="flex items-center gap-1">
                          <Input
                            value={trackingEdit.value}
                            onChange={(e) => setTrackingEdit({ id: s.id, value: e.target.value })}
                            className="h-7 w-44 text-xs"
                            autoFocus
                          />
                          <Button size="sm" variant="deal" className="h-7" onClick={saveTracking} disabled={busy === 'tracking'}>Kaydet</Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setTrackingEdit(null)}>Vazgeç</Button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="font-mono text-xs text-muted-foreground hover:text-brand hover:underline"
                          title="Takip numarasını düzenle"
                          onClick={() => can('shipments.manage') && setTrackingEdit({ id: s.id, value: s.tracking_number ?? '' })}
                        >
                          {s.tracking_number ?? 'takip no yok'}
                        </button>
                      )}
                      {s.tracking_url && (
                        <a href={s.tracking_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
                          Takip et <ExternalLink className="size-3" />
                        </a>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {s.shipped_at ? `Çıkış: ${formatDateTime(s.shipped_at)}` : ''}
                        {s.delivered_at ? ` · Teslim: ${formatDateTime(s.delivered_at)}` : ''}
                      </span>
                    </div>
                    {s.events?.length > 0 && (
                      <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
                        {s.events.slice(-4).map((e, i) => (
                          <li key={i}>{e.date ? `${formatDateTime(e.date)} · ` : ''}{e.description ?? e.status}{e.location ? ` (${e.location})` : ''}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fatura */}
          <div className={cn('rounded-xl border bg-card p-4', invoiceNeeded ? 'border-warning/50' : 'border-border')}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-bold"><Receipt className="size-4 text-brand" /> Fatura</p>
              {can('invoices.manage') && o.payment_status === 'paid' && (
                <Button variant={data.invoice ? 'outline' : 'deal'} size="sm" onClick={() => setInvoiceOpen(true)}>
                  <FileText className="size-3.5" /> {data.invoice ? 'Yeniden Yükle' : 'Fatura Yükle'}
                </Button>
              )}
            </div>

            {data.invoice ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-bold">{data.invoice.invoice_number}</span>
                <span className="text-muted-foreground">{formatDate(data.invoice.issue_date)}</span>
                <span className="font-medium">{formatPrice(data.invoice.total)}</span>
                <StatusBadge status={data.invoice.source} />
                <StatusBadge status={data.invoice.status} />
                <span className="text-[11px] text-muted-foreground">
                  {data.invoice.sent_to_customer_at
                    ? `Müşteriye gönderildi: ${formatDateTime(data.invoice.sent_to_customer_at)}${data.invoice.send_count > 1 ? ` (${data.invoice.send_count}×)` : ''}`
                    : 'Müşteriye henüz gönderilmedi'}
                </span>
                <span className="ml-auto flex gap-1">
                  {data.invoice.has_file && (
                    <Button variant="ghost" size="icon" title="PDF indir" onClick={downloadInvoice}><Download className="size-4" /></Button>
                  )}
                  {can('invoices.manage') && data.invoice.has_file && (
                    <Button variant="ghost" size="icon" title="Müşteriye gönder" disabled={busy === 'invoice-send'} onClick={sendInvoice}>
                      {busy === 'invoice-send' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                  )}
                  {can('invoices.manage') && (
                    <Button variant="ghost" size="icon" className="text-destructive" title="Faturayı sil" onClick={() => setInvoiceDeleteOpen(true)}>
                      <XCircle className="size-4" />
                    </Button>
                  )}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {o.payment_status === 'paid'
                  ? invoiceNeeded
                    ? 'Sipariş kargoya verildi ama faturası yüklenmedi. Muhasebe programında kesip PDF olarak yükleyin.'
                    : 'Fatura henüz yüklenmedi. Muhasebe programında kestikten sonra PDF olarak yükleyin; müşteriye e-posta ile gider.'
                  : 'Ödeme alınmadan fatura yüklenemez.'}
              </p>
            )}
          </div>

          {/* Sekmeler: ödemeler, iadeler, talepler, geçmiş */}
          <Tabs defaultValue="payments">
            <TabsList>
              <TabsTrigger value="payments">Ödemeler ({data.transactions.length})</TabsTrigger>
              <TabsTrigger value="refunds">Para İadeleri ({data.refunds.length})</TabsTrigger>
              <TabsTrigger value="requests">Talepler ({data.returns.length + data.cancellations.length})</TabsTrigger>
              <TabsTrigger value="history">Geçmiş ({data.history.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="mt-3">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {data.transactions.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Bu siparişte ödeme işlemi yok.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Tarih</th>
                        <th className="px-3 py-2 text-left">Tür</th>
                        <th className="px-3 py-2 text-left">Sağlayıcı</th>
                        <th className="px-3 py-2 text-left">Kart</th>
                        <th className="px-3 py-2 text-right">Tutar</th>
                        <th className="px-3 py-2 text-left">Durum</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.transactions.map((t) => (
                        <tr key={t.id}>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(t.created_at)}</td>
                          <td className="px-3 py-2">{t.type === 'refund' ? 'İade' : 'Tahsilat'}</td>
                          <td className="px-3 py-2 capitalize">{t.provider}</td>
                          <td className="px-3 py-2 text-xs">
                            {t.card_mask ? (
                              <span className="flex items-center gap-1">
                                <CreditCard className="size-3" /> {t.card_mask}
                                {t.card_brand ? ` · ${t.card_brand}` : ''}
                                {t.card_bank ? ` · ${t.card_bank}` : ''}
                                {t.installment && t.installment > 1 ? ` · ${t.installment} taksit` : ''}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">{formatPrice(t.amount)}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={t.status} />
                            {t.error_message && (
                              <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-destructive" title={t.error_message}>{t.error_message}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {t.provider_transaction_id && (
                              <Button variant="ghost" size="sm" disabled={retrieving === t.id} onClick={() => retrieveTransaction(t.id)}>
                                {retrieving === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                                POS'tan Sorgula
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="refunds" className="mt-3">
              <div className="rounded-xl border border-border bg-card">
                {data.refunds.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Para iadesi yapılmamış.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {data.refunds.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">{formatPrice(r.amount)} · {r.method}</p>
                          <p className="text-xs text-muted-foreground">{r.reason ?? r.note ?? '—'} · {formatDateTime(r.created_at)}</p>
                          {r.error_message && <p className="text-xs text-destructive">{r.error_message}</p>}
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="requests" className="mt-3">
              <div className="rounded-xl border border-border bg-card">
                {data.returns.length + data.cancellations.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">İptal veya iade talebi yok.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {data.cancellations.map((c) => (
                      <Link key={`c-${c.id}`} to={`/iptaller?q=${c.code}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">İptal talebi {c.code}</p>
                          <p className="text-xs text-muted-foreground">{c.reason} · {formatDateTime(c.created_at)}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </Link>
                    ))}
                    {data.returns.map((r) => (
                      <Link key={`r-${r.id}`} to={`/iadeler?q=${r.code}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">İade talebi {r.code}</p>
                          <p className="text-xs text-muted-foreground">{r.reason} · {formatDateTime(r.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tabular-nums">{formatPrice(r.refund_amount)}</span>
                          <StatusBadge status={r.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-3">
              <div className="rounded-xl border border-border bg-card p-4">
                {data.history.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Henüz durum değişikliği yok.</p>
                ) : (
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    {[...data.history].reverse().map((h) => (
                      <li key={h.id} className="relative">
                        <span className="absolute -left-[25px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-card" />
                        <p className="text-sm">
                          <StatusBadge status={h.to_status} />
                          {h.from_status && h.from_status !== h.to_status && (
                            <span className="ml-2 text-xs text-muted-foreground">({ORDER_STATUS_LABELS[h.from_status] ?? h.from_status} →)</span>
                          )}
                        </p>
                        {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(h.created_at)}{h.actor_name ? ` · ${h.actor_name}` : ''}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Sağ: özet, müşteri, adresler, not ─────────────────────── */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold"><FileText className="size-4 text-brand" /> Tutar Özeti</p>
            <Row label="Ara toplam" value={formatPrice(o.subtotal as number)} />
            {Number(o.discount_total) > 0 && (
              <Row label="İndirim" value={<span className="text-success">−{formatPrice(o.discount_total as number)}</span>} />
            )}
            {Number(o.coupon_discount) > 0 && (
              <Row label="Kupon indirimi" value={<span className="text-success">−{formatPrice(o.coupon_discount as number)}</span>} />
            )}
            <Row label="Kargo" value={Number(o.shipping_total) > 0 ? formatPrice(o.shipping_total as number) : 'Ücretsiz'} />
            <Row label="KDV (dahil)" value={formatPrice(o.tax_total as number)} />
            <div className="my-1.5 border-t border-border" />
            <Row label="Genel toplam" value={formatPrice(o.grand_total)} strong />
            <Row label="Tahsil edilen" value={<span className="text-success">{formatPrice(paidTotal)}</span>} />
            {refundedTotal > 0 && (
              <Row label="İade edilen" value={<span className="text-destructive">{formatPrice(refundedTotal)}</span>} />
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold"><User className="size-4 text-brand" /> Müşteri</p>
            <p className="text-sm font-medium">
              {data.customer ? (
                <Link to={`/musteriler?q=${data.customer.email}`} className="hover:text-brand">
                  {data.customer.first_name} {data.customer.last_name}
                </Link>
              ) : <>{String(o.customer_name ?? 'Misafir')} <Badge variant="secondary" className="ml-1">Misafir</Badge></>}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{String(o.email ?? '')}</p>
            <p className="text-sm text-muted-foreground">{String(o.phone ?? '')}</p>
            {data.customer && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {data.customer.order_count} sipariş · toplam {formatPrice(data.customer.total_spent)}
              </p>
            )}
            {Boolean(o.customer_note) && (
              <p className="mt-2 rounded-lg bg-muted/50 p-2 text-xs"><strong>Müşteri notu:</strong> {String(o.customer_note)}</p>
            )}
            {Boolean(o.gift_note) && (
              <p className="mt-2 rounded-lg bg-brand-soft p-2 text-xs"><strong>Hediye notu:</strong> {String(o.gift_note)}</p>
            )}
          </div>

          <AddressCard title="Teslimat Adresi" icon={MapPin} address={o.shipping_address} />
          <AddressCard title="Fatura Adresi" icon={Receipt} address={o.billing_address} />

          {can('orders.manage') && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold"><StickyNote className="size-4 text-brand" /> Yönetici Notu</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Sadece panelde görünür, müşteriye gitmez…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button variant="deal" size="sm" className="mt-2 w-full" onClick={saveNote} disabled={savingNote}>
                {savingNote && <Loader2 className="size-4 animate-spin" />} Notu Kaydet
              </Button>
            </div>
          )}
        </aside>
      </div>

      <ShipmentDialog
        orderNumber={shipOpen ? orderNumber : null}
        onOpenChange={setShipOpen}
        onDone={() => { setShipOpen(false); refetch(); }}
      />

      <InvoiceUploadDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        orderNumber={orderNumber}
        defaultTotal={Number(o.grand_total)}
        onDone={() => refetch()}
      />

      <ConfirmDialog
        open={invoiceDeleteOpen}
        onOpenChange={setInvoiceDeleteOpen}
        title="Faturayı sil"
        description="Fatura kaydı ve PDF dosyası silinir; müşterinin hesabından da kalkar. Yeni belge yükleyebilirsiniz."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          await adminApi.delete(`/invoices/${data.invoice?.id}`);
          refetch();
        }}
        successMessage="Fatura silindi."
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Siparişi iptal et"
        description="Ayrılan stoklar iade edilir, alınan ödeme karta geri gönderilir ve müşteriye bilgilendirme gider. Bu işlem geri alınamaz."
        variant="destructive"
        confirmLabel="İptal Et"
        requireReason
        reasonLabel="İptal gerekçesi"
        onConfirm={async (reason) => {
          await adminApi.post(`/orders/${orderNumber}/cancel`, { reason });
          refetch();
        }}
        successMessage="Sipariş iptal edildi."
      />

      {/* Para iadesi — tutar girildiği için kendi kutusu */}
      <Dialog open={refundOpen} onOpenChange={(next) => { if (!refunding) setRefundOpen(next); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="size-4 text-destructive" /> Para iadesi</DialogTitle>
            <DialogDescription>
              Tutar sanal POS üzerinden müşterinin kartına iade edilir. İşlem bankada geri alınamaz; kısmi iade için tutarı düşürebilirsiniz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tahsil edilen</span><strong>{formatPrice(paidTotal)}</strong></div>
              {refundedTotal > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Daha önce iade</span><strong>{formatPrice(refundedTotal)}</strong></div>
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-1">
                <span className="text-muted-foreground">İade edilebilir</span>
                <strong className="text-brand">{formatPrice(refundable)}</strong>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">İade tutarı (₺) <span className="text-destructive">*</span></label>
              <Input type="number" step="0.01" min={0.01} max={refundable} autoFocus value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" onClick={() => setRefundAmount(refundable.toFixed(2))} className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">Tamamı</button>
                <button type="button" onClick={() => setRefundAmount((refundable / 2).toFixed(2))} className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">Yarısı</button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Not <span className="text-xs font-normal text-muted-foreground">(isteğe bağlı)</span></label>
              <Input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="Örn. eksik parça için kısmi iade" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={refunding}>Vazgeç</Button>
            <Button variant="destructive" onClick={sendRefund} disabled={refunding}>
              {refunding && <Loader2 className="size-4 animate-spin" />} İadeyi Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
