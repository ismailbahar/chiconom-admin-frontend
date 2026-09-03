import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { errorMessage } from '@/lib/apiError';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** Gerekçe alanı isteniyorsa (red, iptal) — boş bırakılamaz */
  requireReason?: boolean;
  /**
   * Not alanı gösterilsin ama ZORUNLU olmasın.
   *
   * Onay işlemlerinde gerekçe şart değildir; yine de yöneticinin karar notu
   * bırakabilmesi gerekir. `requireReason` ile birlikte kullanılmaz.
   */
  optionalReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => Promise<unknown>;
  successMessage?: string;
}

/**
 * Geri alınamaz işlemler için onay kutusu.
 *
 * `requireReason` açıkken gerekçe girilmeden onay butonu çalışmaz — reddetme
 * ve iptal işlemlerinde karşı tarafa açıklama gitmesi zorunludur.
 */
export default function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = 'Onayla', cancelLabel = 'Vazgeç',
  variant = 'default', requireReason, optionalReason, reasonLabel = 'Gerekçe',
  reasonPlaceholder = 'Karşı tarafa iletilecek açıklamayı yazın…',
  onConfirm, successMessage,
}: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (requireReason && reason.trim().length < 3) {
      toast.error('Lütfen bir gerekçe yazın.');
      return;
    }

    setLoading(true);

    try {
      await onConfirm(requireReason || optionalReason ? (reason.trim() || undefined) : undefined);
      if (successMessage) toast.success(successMessage);
      onOpenChange(false);
      setReason('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) { onOpenChange(next); if (!next) setReason(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {variant === 'destructive' && <AlertTriangle className="size-4 text-destructive" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {(requireReason || optionalReason) && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {reasonLabel}{' '}
              {requireReason
                ? <span className="text-destructive">*</span>
                : <span className="text-xs font-normal text-muted-foreground">(isteğe bağlı)</span>}
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={reasonPlaceholder}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'deal'}
            onClick={confirm}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
