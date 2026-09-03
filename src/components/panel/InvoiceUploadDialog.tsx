import { useEffect, useState } from 'react';
import { FileUp, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { adminApi } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/apiError';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  /** Sipariş tutarı — fatura tutarı alanı bununla önceden doldurulur. */
  defaultTotal?: number;
  onDone: () => void;
}

/**
 * FATURA YÜKLEME KUTUSU.
 *
 * Fatura muhasebe programında kesilir; PDF'i, numarası ve tarihi buradan
 * siparişe eklenir. "Müşteriye gönder" açıksa belge hemen e-posta ekiyle gider.
 */
export default function InvoiceUploadDialog({ open, onOpenChange, orderNumber, defaultTotal, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState('');
  const [send, setSend] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setNumber('');
      setErrors({});
      setTotal(defaultTotal ? defaultTotal.toFixed(2) : '');
    }
  }, [open, defaultTotal]);

  const submit = async () => {
    if (!file) {
      setErrors({ file: 'PDF dosyası seçin.' });
      return;
    }

    if (number.trim().length < 3) {
      setErrors({ invoice_number: 'Fatura numarasını girin.' });
      return;
    }

    setSaving(true);
    setErrors({});

    const form = new FormData();
    form.append('file', file);
    form.append('invoice_number', number.trim());
    form.append('issue_date', date);
    if (total) form.append('total', total);
    form.append('send', send ? '1' : '0');

    try {
      const { data } = await adminApi.post(`/orders/${orderNumber}/invoice`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message);
      onDone();
      onOpenChange(false);
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="size-4 text-brand" /> Fatura yükle — {orderNumber}</DialogTitle>
          <DialogDescription>
            Muhasebe programında kestiğiniz faturanın PDF'ini ekleyin. Belge müşterinin hesabında görünür ve e-posta ekiyle iletilir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Fatura PDF <span className="text-destructive">*</span></label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input bg-muted/30 px-3 py-3 text-sm hover:bg-muted/60">
              <FileUp className="size-5 text-brand" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : 'PDF seçmek için tıklayın (en fazla 10 MB)'}</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {errors.file && <p className="mt-1 text-xs text-destructive">{errors.file}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Fatura No <span className="text-destructive">*</span></label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="CHC2026000001" autoFocus />
              {errors.invoice_number && <p className="mt-1 text-xs text-destructive">{errors.invoice_number}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Fatura Tarihi</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Fatura Tutarı (₺)</label>
            <Input type="number" step="0.01" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">Boş bırakılırsa sipariş tutarı yazılır.</p>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span>
              <span className="font-medium">Müşteriye hemen gönder</span>
              <span className="block text-xs text-muted-foreground">Kapalıysa sonradan Faturalar ekranından gönderebilirsiniz.</span>
            </span>
            <Switch checked={send} onCheckedChange={setSend} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Vazgeç</Button>
          <Button variant="deal" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Kaydet{send ? ' ve Gönder' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
