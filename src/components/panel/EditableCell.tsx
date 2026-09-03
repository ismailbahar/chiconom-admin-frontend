import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { errorMessage } from '@/lib/apiError';
import { cn, formatPrice } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════
   SATIR İÇİ DÜZENLEME
   İki biçim vardır ve ikisi de tabloyu terk etmeden çalışır:

     · EditableSwitch → aç/kapa alanları (aktif/pasif, kargo bedava)
     · EditableField  → kalem ikonuna basınca açılan animasyonlu popup
                        (stok, fiyat, metin)

   Ortak davranış: değer İYİMSER güncellenir (anında ekranda görünür),
   istek başarısız olursa ESKİ DEĞERE geri döner ve hata gösterilir.
   Böylece 100 satırlık tabloda tek tek kaydet beklemek gerekmez.
   ═══════════════════════════════════════════════════════════════════════ */

interface SwitchProps {
  value: boolean;
  onSave: (next: boolean) => Promise<unknown>;
  disabled?: boolean;
  labels?: [string, string];
  className?: string;
}

export function EditableSwitch({
  value,
  onSave,
  disabled,
  labels = ['Pasif', 'Aktif'],
  className,
}: SwitchProps) {
  const [checked, setChecked] = useState(value);
  const [saving, setSaving] = useState(false);

  // Dışarıdan (tablo yenilenince) gelen değer değişirse eşitle
  useEffect(() => setChecked(value), [value]);

  const toggle = async (next: boolean) => {
    setChecked(next);          // iyimser güncelleme
    setSaving(true);

    try {
      await onSave(next);
    } catch (error) {
      setChecked(!next);       // başarısızsa geri al
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Switch checked={checked} onCheckedChange={toggle} disabled={disabled || saving} />
      <span
        className={cn(
          'text-xs font-medium transition-colors',
          checked ? 'text-success' : 'text-muted-foreground',
        )}
      >
        {saving ? <Loader2 className="size-3 animate-spin" /> : labels[checked ? 1 : 0]}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

interface FieldProps {
  value: string | number | null;
  onSave: (next: string) => Promise<unknown>;
  /** number → sayısal klavye + hizalama, currency → ₺ biçimli gösterim */
  type?: 'text' | 'number' | 'currency' | 'textarea';
  label?: string;
  hint?: string;
  suffix?: string;
  min?: number;
  max?: number;
  /** Değer sıfır/boşken dikkat çekici göster (ör. stok 0) */
  warnWhenZero?: boolean;
  disabled?: boolean;
  className?: string;
}

export function EditableField({
  value,
  onSave,
  type = 'text',
  label,
  hint,
  suffix,
  min,
  max,
  warnWhenZero,
  disabled,
  className,
}: FieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    setCurrent(value);
    setDraft(String(value ?? ''));
  }, [value]);

  const numeric = type === 'number' || type === 'currency';

  const display = (() => {
    if (current === null || current === '') return '—';
    if (type === 'currency') return formatPrice(current);
    return `${current}${suffix ? ' ' + suffix : ''}`;
  })();

  const isZero = warnWhenZero && Number(current) === 0;

  const save = async () => {
    const trimmed = draft.trim();

    if (trimmed === String(current ?? '')) {
      setOpen(false);
      return;
    }

    if (numeric) {
      const parsed = Number(trimmed.replace(',', '.'));

      if (Number.isNaN(parsed)) {
        toast.error('Geçerli bir sayı girin.');
        return;
      }
      if (min !== undefined && parsed < min) {
        toast.error(`En küçük değer ${min} olabilir.`);
        return;
      }
      if (max !== undefined && parsed > max) {
        toast.error(`En büyük değer ${max} olabilir.`);
        return;
      }
    }

    setSaving(true);

    try {
      await onSave(trimmed);
      setCurrent(numeric ? Number(trimmed.replace(',', '.')) : trimmed);
      setOpen(false);
      toast.success('Kaydedildi');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setDraft(String(current ?? '')); }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'group/edit inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm transition-colors',
            'hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50',
            numeric && 'tabular-nums',
            isZero && 'text-destructive font-semibold',
            className,
          )}
        >
          <span className={cn(!isZero && 'font-medium')}>{display}</span>
          {/* Kalem ikonu normalde soluk, hover'da belirir ve hafifçe döner */}
          <Pencil
            className={cn(
              'size-3 shrink-0 text-muted-foreground transition-all duration-200',
              'opacity-0 -rotate-12 group-hover/edit:opacity-100 group-hover/edit:rotate-0 group-hover/edit:text-brand',
              open && 'opacity-100 rotate-0 text-brand',
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64" align="start">
        <div className="space-y-3">
          {label && (
            <div>
              <p className="text-sm font-bold">{label}</p>
              {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
            </div>
          )}

          {type === 'textarea' ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <div className="relative">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); save(); }
                  if (e.key === 'Escape') setOpen(false);
                }}
                inputMode={numeric ? 'decimal' : 'text'}
                className={cn('h-9', numeric && 'tabular-nums pr-9')}
              />
              {suffix && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {suffix}
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              <X className="size-3.5" /> Vazgeç
            </Button>
            <Button variant="deal" size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Kaydet
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border px-1">Enter</kbd> kaydeder,{' '}
            <kbd className="rounded border border-border px-1">Esc</kbd> kapatır.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

interface SelectProps {
  value: string;
  options: Array<{ label: string; value: string }>;
  onSave: (next: string) => Promise<unknown>;
  disabled?: boolean;
  className?: string;
}

/** Açılır listeden seçilen alanlar (durum, kategori) için satır içi düzenleme. */
export function EditableSelect({ value, options, onSave, disabled, className }: SelectProps) {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => setCurrent(value), [value]);

  const change = async (next: string) => {
    const previous = current;
    setCurrent(next);
    setSaving(true);

    try {
      await onSave(next);
      toast.success('Kaydedildi');
    } catch (error) {
      setCurrent(previous);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={disabled || saving}
        className={cn(
          'h-7 rounded-md border border-input bg-background pl-2 pr-6 text-xs',
          'focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {saving && <Loader2 className="pointer-events-none absolute -right-5 size-3 animate-spin text-brand" />}
    </div>
  );
}
