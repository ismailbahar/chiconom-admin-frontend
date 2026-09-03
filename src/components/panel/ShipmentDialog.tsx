import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';

interface Company {
  id: number;
  name: string;
  code: string;
  has_integration: boolean;
}

interface Props {
  /** Dolu ise kutu açılır. */
  orderNumber: string | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * KARGOYA VERME KUTUSU.
 *
 * Kargo firması + takip numarası girilir; sunucu gönderiyi oluşturup
 * siparişi "kargoya verildi" yapar ve müşteriye SMS/e-posta yollar.
 * Entegrasyonlu firmada (Yurtiçi) takip numarası boş bırakılabilir —
 * sunucu API'den alır.
 */
export default function ShipmentDialog({ orderNumber, onOpenChange, onDone }: Props) {
  const [company, setCompany] = useState('');
  const [tracking, setTracking] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ['shipping-companies-active'],
    queryFn: async () => (await adminApi.get('/resources/shipping-companies', { params: { per_page: 50, filter_is_active: 1 } })).data.data,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (orderNumber) {
      setTracking('');
      setCompany((prev) => prev || companies?.[0]?.code || '');
    }
  }, [orderNumber, companies]);

  const selected = companies?.find((c) => c.code === company);

  const submit = async () => {
    if (!orderNumber) return;

    if (!selected?.has_integration && tracking.trim().length < 4) {
      toast.error('Takip numarası girin.');
      return;
    }

    setSaving(true);

    try {
      const { data } = await adminApi.post(`/orders/${orderNumber}/shipments`, {
        company_code: company || null,
        tracking_number: tracking.trim() || null,
        mark_shipped: true,
      });
      toast.success(data.message);
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(orderNumber)} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Truck className="size-4 text-brand" /> Kargoya ver — {orderNumber}</DialogTitle>
          <DialogDescription>
            Gönderi oluşturulur, sipariş "Kargoya Verildi" olur ve müşteriye takip numarası e-posta/SMS ile gider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kargo firması</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(companies ?? []).map((c) => (
                <option key={c.code} value={c.code}>{c.name}{c.has_integration ? ' (entegre)' : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Takip numarası {selected?.has_integration
                ? <span className="text-xs font-normal text-muted-foreground">(boş bırakılırsa entegrasyondan alınır)</span>
                : <span className="text-destructive">*</span>}
            </label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Örn. 1234567890123" autoFocus />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Vazgeç</Button>
          <Button variant="deal" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Kargoya Ver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
