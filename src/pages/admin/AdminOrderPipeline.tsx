import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Banknote, Clock, Kanban, Loader2, Package, RotateCcw, Truck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import StatusBadge, { ORDER_STATUS_LABELS } from '@/components/panel/StatusBadge';
import ShipmentDialog from '@/components/panel/ShipmentDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { usePanelAuthStore } from '@/stores/panelAuthStore';
import { cn, formatPrice } from '@/lib/utils';

interface Card {
  order_number: string;
  customer_name: string | null;
  grand_total: number;
  items_count: number;
  payment_status: string;
  created_at: string;
  age_hours: number;
  tracking_number: string | null;
  next_statuses: string[];
}

interface Column {
  status: string;
  label: string;
  total: number;
  next: string | null;
  orders: Card[];
}

interface Pipeline {
  data: Column[];
  closed: { cancelled: number; refunded: number; failed: number };
  labels: Record<string, string>;
}

const COLUMN_STYLE: Record<string, string> = {
  pending:    'border-t-warning',
  paid:       'border-t-success',
  processing: 'border-t-brand',
  shipped:    'border-t-sky-500',
  delivered:  'border-t-emerald-600',
  completed:  'border-t-muted-foreground',
};

/** Bekleme süresini insan diliyle yazar; uzun bekleyenler kırmızıya döner. */
function Age({ hours }: { hours: number }) {
  const text = hours < 1 ? 'az önce' : hours < 24 ? `${hours} sa` : `${Math.floor(hours / 24)} gün`;
  const tone = hours >= 72 ? 'text-destructive' : hours >= 24 ? 'text-warning' : 'text-muted-foreground';

  return <span className={cn('flex items-center gap-1 text-[11px]', tone)}><Clock className="size-3" /> {text}</span>;
}

/**
 * SİPARİŞ PANOSU.
 *
 * Her durum bir sütun, her sipariş bir kart: ödeme bekleyenden tamamlanana
 * kadar tüm akış tek ekranda. Kartın altındaki düğme siparişi bir sonraki
 * adıma geçirir; kargoya verme takip numarası istediğinden küçük bir kutu açar.
 * Sütun başına en fazla 15 kart gelir; kalanı ilgili durum sayfasındadır.
 */
export default function AdminOrderPipeline() {
  const can = usePanelAuthStore((s) => s.can);
  const [busy, setBusy] = useState<string | null>(null);
  const [shipOrder, setShipOrder] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<Pipeline>({
    queryKey: ['admin-order-pipeline'],
    queryFn: async () => (await adminApi.get('/orders/pipeline?limit=15')).data,
    refetchInterval: 45_000,
  });

  useEffect(() => {
    document.title = 'Sipariş Panosu — Chiconom Yönetim';
  }, []);

  const move = async (orderNumber: string, status: string) => {
    setBusy(orderNumber);

    try {
      const { data: res } = await adminApi.patch(`/orders/${orderNumber}/status`, { status });
      toast.success(res.message);
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async (orderNumber: string) => {
    setBusy(orderNumber);

    try {
      const { data: res } = await adminApi.post(`/orders/${orderNumber}/paid`);
      toast.success(res.message);
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const totalOpen = (data?.data ?? [])
    .filter((c) => !['completed'].includes(c.status))
    .reduce((sum, c) => sum + c.total, 0);

  return (
    <div>
      <PageHeader
        title="Sipariş Panosu"
        description="Ödeme bekleyen → ödendi → hazırlanıyor → kargoda → teslim → tamamlandı. Kart üzerindeki düğmeyle ilerletin."
        icon={Kanban}
        actions={
          <>
            <Badge variant="soft" className="gap-1">{totalOpen} açık sipariş</Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RotateCcw className={cn('size-3.5', isLoading && 'animate-spin')} /> Yenile
            </Button>
          </>
        }
      />

      {isLoading && !data ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-brand" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-3 scrollbar-thin">
          <div className="flex min-w-max gap-3">
            {(data?.data ?? []).map((column, i) => (
              <div key={column.status} className="flex w-72 shrink-0 items-start gap-3">
                <div className={cn('flex w-72 flex-col rounded-xl border border-border border-t-4 bg-card', COLUMN_STYLE[column.status])}>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-bold">{column.label}</p>
                      <Link to={`/siparisler/durum/${column.status}`} className="text-[11px] text-muted-foreground hover:text-brand hover:underline">
                        {column.total} sipariş · tümünü gör
                      </Link>
                    </div>
                    <Badge variant={column.total > 0 ? 'deal' : 'secondary'}>{column.total}</Badge>
                  </div>

                  <div className="max-h-[70vh] space-y-2 overflow-y-auto border-t border-border p-2 scrollbar-thin">
                    {column.orders.length === 0 && (
                      <p className="py-8 text-center text-xs text-muted-foreground">Bu adımda sipariş yok.</p>
                    )}

                    {column.orders.map((card) => {
                      const next = column.next;
                      const isBusy = busy === card.order_number;

                      return (
                        <div key={card.order_number} className="rounded-lg border border-border bg-background p-2.5 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <Link to={`/siparisler/${card.order_number}`} className="font-mono text-xs font-bold text-brand hover:underline">
                              {card.order_number}
                            </Link>
                            <Age hours={card.age_hours} />
                          </div>
                          <p className="mt-1 line-clamp-1 text-sm">{card.customer_name ?? 'Misafir'}</p>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Package className="size-3" /> {card.items_count} kalem</span>
                            <span className="font-bold text-foreground">{formatPrice(card.grand_total)}</span>
                          </div>
                          {card.tracking_number && (
                            <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                              <Truck className="size-3" /> {card.tracking_number}
                            </p>
                          )}

                          {can('orders.manage') && (
                            <div className="mt-2 flex gap-1.5">
                              {column.status === 'pending' ? (
                                <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" disabled={isBusy} onClick={() => markPaid(card.order_number)}>
                                  {isBusy ? <Loader2 className="size-3 animate-spin" /> : <Banknote className="size-3" />} Ödendi İşaretle
                                </Button>
                              ) : next === 'shipped' ? (
                                <Button size="sm" variant="deal" className="h-7 flex-1 gap-1 text-xs" disabled={isBusy} onClick={() => setShipOrder(card.order_number)}>
                                  <Truck className="size-3" /> Kargoya Ver
                                </Button>
                              ) : next && card.next_statuses.includes(next) ? (
                                <Button size="sm" variant="deal" className="h-7 flex-1 gap-1 text-xs" disabled={isBusy} onClick={() => move(card.order_number, next)}>
                                  {isBusy ? <Loader2 className="size-3 animate-spin" /> : null}
                                  {ORDER_STATUS_LABELS[next]} <ArrowRight className="size-3" />
                                </Button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {i < (data?.data.length ?? 0) - 1 && (
                  <ArrowRight className="mt-6 size-5 shrink-0 text-muted-foreground/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kapananlar — akışın dışında ama görünür olsun */}
      {data && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          <XCircle className="size-4 text-destructive" />
          <span className="text-muted-foreground">Akış dışı:</span>
          <Link to="/siparisler/durum/closed" className="hover:underline"><StatusBadge status="cancelled" /> {data.closed.cancelled}</Link>
          <Link to="/siparisler/durum/closed" className="hover:underline"><StatusBadge status="refunded" /> {data.closed.refunded}</Link>
          <Link to="/siparisler/durum/closed" className="hover:underline"><StatusBadge status="failed" /> {data.closed.failed}</Link>
        </div>
      )}

      <ShipmentDialog
        orderNumber={shipOrder}
        onOpenChange={(open) => { if (!open) setShipOrder(null); }}
        onDone={() => { setShipOrder(null); refetch(); }}
      />
    </div>
  );
}
