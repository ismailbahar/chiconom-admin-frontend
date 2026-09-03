import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import ServerTable from '@/components/panel/ServerTable';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { EditableSwitch } from '@/components/panel/EditableCell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useServerTable } from '@/hooks/useServerTable';
import { adminApi } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/apiError';
import { formatDate, formatPrice } from '@/lib/utils';
import { RESOURCE_CONFIGS, type FieldConfig } from './resourceConfigs';

type Row = Record<string, unknown> & { id: number };

/**
 * ORTAK KAYNAK EKRANI.
 *
 * Marka, kupon, banner, sayfa, SSS, blog, şablon… gibi düz CRUD kaynakların
 * tamamı bu tek ekranla yönetilir. Hangi alanların gösterileceği
 * `resourceConfigs.ts` içinde tanımlıdır; yeni kaynak eklemek için ekran
 * yazmak gerekmez, tek bir yapılandırma girdisi yeterlidir.
 *
 * Backend tarafı da simetriktir (AdminResourceController) — böylece listeleme,
 * filtreleme, Excel dışa aktarım ve doğrulama davranışı her kaynakta aynıdır.
 */
/**
 * @param resourceKey Adres çubuğu yerine dışarıdan verilen kaynak adı.
 *   Sekmeli sayfalar bu ekranı içine gömebilir.
 * @param hideHeader Gömülü kullanımda dış sayfanın kendi başlığı vardır;
 *   ikinci bir başlık ekranı çift başlıklı gösterir.
 */
export default function AdminResource({
  resourceKey,
  hideHeader = false,
}: {
  resourceKey?: string;
  hideHeader?: boolean;
} = {}) {
  const params = useParams();
  const resource = resourceKey ?? params.resource ?? '';
  const config = RESOURCE_CONFIGS[resource];

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    if (!config) return [];

    const list: ColumnDef<Row, unknown>[] = config.columns.map((column) => ({
      accessorKey: column.key,
      header: column.label,
      cell: ({ row }) => {
        const value = row.original[column.key];

        // Aç/kapa alanları switch olarak gösterilir — tabloyu terk etmeden değişir
        if (column.type === 'boolean') {
          return (
            <EditableSwitch
              value={Boolean(value)}
              onSave={async (next) => {
                await adminApi.patch(`/resources/${resource}/${row.original.id}`, { [column.key]: next });
                table.patchRow(row.original.id, { [column.key]: next } as Partial<Row>);
              }}
            />
          );
        }

        if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;

        switch (column.type) {
          case 'currency': return <span className="tabular-nums">{formatPrice(Number(value))}</span>;
          case 'date':     return <span className="whitespace-nowrap text-xs">{formatDate(String(value))}</span>;
          case 'badge':    return <Badge variant="soft">{String(value)}</Badge>;
          case 'image':
            return (
              <div className="size-9 overflow-hidden rounded bg-secondary/40">
                <img src={String(value)} alt="" className="size-full object-contain" />
              </div>
            );
          case 'color':
            return (
              <span className="flex items-center gap-1.5">
                <span className="size-4 rounded border border-border" style={{ background: String(value) }} />
                <span className="font-mono text-xs">{String(value)}</span>
              </span>
            );
          default:
            return <span className="line-clamp-1 text-sm">{String(value)}</span>;
        }
      },
      meta: {
        exportHeader: column.label,
        align: ['currency', 'number'].includes(column.type ?? '') ? 'right' : undefined,
        exportFormat: column.type === 'currency' ? 'currency'
          : column.type === 'boolean' ? 'boolean'
            : column.type === 'date' ? 'date' : undefined,
        disableFilter: column.type !== 'text',
      },
    }));

    list.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(row.original)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="size-8 text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
      meta: { skipExport: true, disableFilter: true, align: 'right' },
      enableSorting: false,
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, config]);

  const table = useServerTable<Row>({
    api: adminApi,
    endpoint: `/resources/${resource}`,
    columns,
    extraParams: { q: search },
    exportFilename: resource,
    enabled: Boolean(config),
  });

  if (!config) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Tanımsız kaynak: <code className="font-mono">{resource}</code>
        </p>
      </div>
    );
  }

  return (
    <div>
      {hideHeader ? (
        !config.noCreate && (
          <div className="mb-3 flex justify-end">
            <Button variant="deal" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Yeni {config.singular}
            </Button>
          </div>
        )
      ) : (
        <PageHeader
          title={config.title}
          description={config.description}
          icon={config.icon}
          actions={
            !config.noCreate && (
              <Button variant="deal" size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Yeni {config.singular}
              </Button>
            )
          }
        />
      )}

      <ServerTable
        {...table.tableProps}
        columns={columns}
        emptyText={`Henüz ${config.singular.toLocaleLowerCase('tr-TR')} eklenmemiş.`}
        toolbar={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara…"
            className="h-8 w-56 text-xs"
          />
        }
      />

      <ResourceForm
        resource={resource}
        config={config}
        row={editing}
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); table.refresh(); }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={`${config.singular} sil`}
        description="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        variant="destructive"
        successMessage="Kayıt silindi."
        onConfirm={async () => {
          await adminApi.delete(`/resources/${resource}/${deleteId}`);
          table.removeRow(deleteId!);
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

function ResourceForm({
  resource, config, row, open, onClose, onSaved,
}: {
  resource: string;
  config: (typeof RESOURCE_CONFIGS)[string];
  row: Row | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialised, setInitialised] = useState(false);

  // Düzenlemeye girilince mevcut değerleri forma doldur
  if (open && !initialised) {
    const initial: Record<string, unknown> = {};

    config.fields.forEach((field) => {
      initial[field.key] = row?.[field.key] ?? field.default ?? (field.type === 'boolean' ? false : '');
    });

    setValues(initial);
    setInitialised(true);
  }

  const close = () => {
    setInitialised(false);
    setErrors({});
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setErrors({});

    try {
      // Boş opsiyonel alanları göndermiyoruz — sunucuda null/'' karmaşası olmasın
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== '' && v !== undefined),
      );

      if (row) {
        await adminApi.patch(`/resources/${resource}/${row.id}`, payload);
      } else {
        await adminApi.post(`/resources/${resource}`, payload);
      }

      toast.success(row ? 'Kayıt güncellendi.' : 'Kayıt oluşturuldu.');
      setInitialised(false);
      onSaved();
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {row ? `${config.singular} Düzenle` : `Yeni ${config.singular}`}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {config.fields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              value={values[field.key]}
              error={errors[field.key]}
              onChange={(v) => {
                setValues((prev) => ({ ...prev, [field.key]: v }));
                setErrors((prev) => ({ ...prev, [field.key]: '' }));
              }}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>Vazgeç</Button>
          <Button variant="deal" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  field, value, error, onChange,
}: {
  field: FieldConfig;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const wide = field.type === 'textarea' || field.type === 'html' || field.wide;

  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className="mb-1.5 block text-sm font-medium">
        {field.label} {field.required && <span className="text-destructive">*</span>}
      </label>

      {field.type === 'boolean' ? (
        <label className="flex cursor-pointer items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-input accent-brand"
          />
          <span className="text-sm text-muted-foreground">{field.hint ?? 'Aktif'}</span>
        </label>
      ) : field.type === 'select' ? (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Seçiniz</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : field.type === 'textarea' || field.type === 'html' ? (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={field.type === 'html' ? 8 : 3}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <Input
          type={field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.type === 'number' || field.type === 'currency' ? e.target.value : e.target.value)}
          placeholder={field.placeholder}
          step={field.type === 'currency' ? '0.01' : undefined}
        />
      )}

      {field.hint && field.type !== 'boolean' && (
        <p className="mt-1 text-[11px] text-muted-foreground">{field.hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
