import { useEffect, useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/apiError';
import { cn } from '@/lib/utils';

export type MailTarget =
  | { kind: 'customer'; id: number }
  | { kind: 'order'; orderNumber: string };

interface Template {
  key: string;
  name: string;
  description: string | null;
  subject: string;
  variables: string[] | null;
  is_marketing: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MailTarget;
  /** Alıcı bilgisi yalnızca başlıkta gösterilir; adres sunucudan alınır. */
  email?: string | null;
  name?: string | null;
}

type Mode = 'free' | 'template';

const FIELD =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

/**
 * MÜŞTERİYE E-POSTA GÖNDERME KUTUSU.
 *
 * · Serbest mesaj: konu + metin; "Manuel Mesaj" zarf şablonuyla (site
 *   başlığı, selamlama, imza) gider, satır sonları korunur.
 * · Hazır şablon: Şablonlar menüsündeki aktif e-posta şablonlarından biri,
 *   müşteri/sipariş değişkenleri ({first_name}, {order_number}…) dolarak gider.
 * Sipariş sayfasından açılınca sipariş değişkenleri de kullanılabilir.
 */
export default function CustomerMailDialog({ open, onOpenChange, target, email, name }: Props) {
  const [mode, setMode] = useState<Mode>('free');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('free');
    setSubject('');
    setMessage('');
    setTemplateKey('');
    setErrors({});

    setLoadingTemplates(true);
    adminApi.get('/customer-mail/templates')
      .then((res) => setTemplates((res.data?.data ?? []) as Template[]))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [open]);

  const selectedTemplate = templates.find((t) => t.key === templateKey) ?? null;
  const endpoint = target.kind === 'customer' ? `/customers/${target.id}/mail` : `/orders/${target.orderNumber}/mail`;

  const submit = async () => {
    const next: Record<string, string> = {};
    if (mode === 'free') {
      if (subject.trim().length < 2) next.subject = 'Konu girin.';
      if (message.trim().length < 2) next.message = 'Mesaj girin.';
    } else if (!templateKey) {
      next.template_key = 'Şablon seçin.';
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setSending(true);
    setErrors({});
    try {
      const { data } = await adminApi.post(endpoint, {
        mode,
        subject: mode === 'free' ? subject.trim() : undefined,
        message: mode === 'free' ? message.trim() : undefined,
        template_key: mode === 'template' ? templateKey : undefined,
      });
      toast.success(String(data?.message ?? 'E-posta gönderildi.'));
      onOpenChange(false);
    } catch (err) {
      const fields = fieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      toast.error(errorMessage(err, 'E-posta gönderilemedi.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="size-5 text-brand" /> Müşteriye E-posta Gönder</DialogTitle>
          <DialogDescription>
            Alıcı: <span className="font-medium text-foreground">{name || '—'}</span>
            {email && <span className="text-muted-foreground"> · {email}</span>}
            {target.kind === 'order' && <span className="text-muted-foreground"> · Sipariş {target.orderNumber}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Mod seçimi */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          {(['free', 'template'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setErrors({}); }}
              className={cn(
                'rounded-md px-3 py-1.5 font-medium transition',
                mode === m ? 'bg-card text-brand shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'free' ? 'Serbest mesaj' : 'Hazır şablon'}
            </button>
          ))}
        </div>

        {mode === 'free' ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Konu</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="Örn. Siparişiniz hakkında" />
              {errors.subject && <p className="mt-1 text-xs text-destructive">{errors.subject}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Mesaj</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                maxLength={5000}
                placeholder={'Merhaba,\n\n…'}
                className={FIELD}
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>
                  {errors.message
                    ? <span className="text-destructive">{errors.message}</span>
                    : 'Selamlama ("Merhaba <ad>") ve imza otomatik eklenir.'}
                </span>
                <span>{message.length}/5000</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Şablon</label>
              <select
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                disabled={loadingTemplates}
                className={cn(FIELD, 'h-10')}
              >
                <option value="">{loadingTemplates ? 'Yükleniyor…' : 'Şablon seçin'}</option>
                {templates.map((t) => (
                  <option key={t.key} value={t.key}>{t.name}{t.is_marketing ? ' (pazarlama)' : ''}</option>
                ))}
              </select>
              {errors.template_key && <p className="mt-1 text-xs text-destructive">{errors.template_key}</p>}
            </div>

            {selectedTemplate && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <p><span className="font-semibold">Konu:</span> {selectedTemplate.subject}</p>
                {selectedTemplate.description && <p className="mt-1 text-muted-foreground">{selectedTemplate.description}</p>}
                {!!selectedTemplate.variables?.length && (
                  <p className="mt-1 text-muted-foreground">
                    Değişkenler: {selectedTemplate.variables.map((v) => `{${v}}`).join(', ')}
                    {target.kind === 'customer' && ' — sipariş değişkenleri müşteri sayfasından boş kalır; sipariş sayfasından gönderin.'}
                  </p>
                )}
                {selectedTemplate.is_marketing && (
                  <p className="mt-1 text-warning">Pazarlama şablonu: e-posta izni olmayan müşteriye gönderilmez.</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Vazgeç</Button>
          <Button onClick={submit} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
