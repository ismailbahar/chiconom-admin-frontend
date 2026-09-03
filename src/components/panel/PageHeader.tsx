import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  icon?: React.ElementType;
  /** Sağ tarafa yerleşen aksiyonlar (Yeni Ekle, Dışa Aktar…) */
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, icon: Icon, actions, className }: Props) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

/** Panel üstündeki özet kartları. */
export function StatCard({
  label, value, hint, icon: Icon, tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ElementType;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
}) {
  const tones = {
    default: 'bg-muted text-foreground',
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
