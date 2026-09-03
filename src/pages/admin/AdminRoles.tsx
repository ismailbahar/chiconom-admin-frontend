import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check, Loader2, Lock, Plus, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatNumber } from '@/lib/utils';

interface Role {
  id: number;
  name: string;
  user_count: number;
  permissions: string[];
  is_system: boolean;
}

/** { "Katalog": { "products.view": "Ürünleri görüntüle", … } } */
type Catalog = Record<string, Record<string, string>>;

const ROLE_LABELS: Record<string, string> = {
  'super-admin': 'Süper Yönetici',
  admin: 'Yönetici',
  operasyon: 'Operasyon',
  muhasebe: 'Muhasebe',
  destek: 'Destek',
  'icerik': 'İçerik Editörü',
};

/**
 * Roller ve yetkiler.
 *
 * Yetki adları (`alan.eylem`) hem sunucudaki `permission:` ara katmanında hem
 * de panel menüsünün gizleme mantığında kullanılır — yani buradan bir yetkiyi
 * kaldırmak hem uçları kapatır hem menü öğesini gizler.
 *
 * `super-admin` rolü değiştirilemez: yetki kontrolü onu her zaman geçirir,
 * yetkilerini kısıtlamak sahte bir güvenlik hissi yaratırdı.
 */
export default function AdminRoles() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  useEffect(() => {
    document.title = 'Roller ve Yetkiler — Yönetim';
  }, []);

  const { data, isLoading, refetch } = useQuery<{ data: Role[]; catalog: Catalog }>({
    queryKey: ['admin-roles'],
    queryFn: async () => (await adminApi.get('/roles')).data,
  });

  const roles = data?.data ?? [];
  const catalog = data?.catalog ?? {};

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;

  // Rol değişince taslağı sunucudaki hâline sıfırla
  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allPermissions = useMemo(
    () => Object.values(catalog).flatMap((group) => Object.keys(group)),
    [catalog],
  );

  const locked = selected?.name === 'super-admin';
  const dirty = useMemo(() => {
    if (!selected || !draft) return false;
    const current = new Set(selected.permissions);
    if (current.size !== draft.size) return true;
    return [...draft].some((p) => !current.has(p));
  }, [selected, draft]);

  const toggle = (permission: string) => {
    if (locked || !draft) return;

    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission); else next.add(permission);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    if (locked || !draft) return;

    const keys = Object.keys(catalog[group] ?? {});
    const allOn = keys.every((k) => draft.has(k));

    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const save = async () => {
    if (!selected || !draft) return;

    setSaving(true);

    try {
      const { data: res } = await adminApi.patch(`/roles/${selected.id}`, { permissions: [...draft] });
      toast.success(res.message);
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (newName.trim().length < 2) {
      toast.error('Rol adı en az 2 karakter olmalı.');
      return;
    }

    setSaving(true);

    try {
      // Yeni rol, o an ekranda seçili olan rolün yetkileriyle başlar — sıfırdan
      // 40+ kutu işaretlemek yerine mevcut bir rolü kopyalamak pratik olur.
      const { data: res } = await adminApi.post('/roles', {
        name: newName.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, '-'),
        permissions: draft ? [...draft] : ['dashboard.view'],
      });

      toast.success(res.message);
      setCreateOpen(false);
      setNewName('');
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Roller ve Yetkiler"
        description="Bir yetkiyi kapatmak hem ilgili API ucunu hem de menüdeki bağlantıyı kapatır."
        icon={ShieldCheck}
        actions={
          <Button variant="deal" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Yeni Rol
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Rol listesi */}
        <aside className="space-y-1.5">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedId(role.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors',
                selected?.id === role.id
                  ? 'border-brand bg-brand-soft'
                  : 'border-border bg-card hover:border-brand/40',
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                  {role.is_system && <Lock className="size-3 shrink-0 text-muted-foreground" />}
                  {ROLE_LABELS[role.name] ?? role.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Users className="size-3" /> {formatNumber(role.user_count)} kullanıcı ·{' '}
                  {role.name === 'super-admin' ? 'tüm yetkiler' : `${role.permissions.length} yetki`}
                </p>
              </div>

              {!role.is_system && (
                <span
                  role="button"
                  tabIndex={0}
                  title="Rolü sil"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteTarget(role); } }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </span>
              )}
            </button>
          ))}
        </aside>

        {/* Yetki matrisi */}
        <div className="min-w-0 rounded-xl border border-border bg-card">
          {!selected ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Soldan bir rol seçin.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <p className="font-bold">{ROLE_LABELS[selected.name] ?? selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1 py-0.5">{selected.name}</code>
                    {' · '}
                    {locked ? 'tüm yetkilere sahiptir' : `${draft?.size ?? 0} / ${allPermissions.length} yetki seçili`}
                  </p>
                </div>

                {!locked && (
                  <div className="flex items-center gap-2">
                    {dirty && <Badge variant="warning">Kaydedilmemiş değişiklik</Badge>}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!dirty || saving}
                      onClick={() => setDraft(new Set(selected.permissions))}
                    >
                      Geri Al
                    </Button>
                    <Button variant="deal" size="sm" disabled={!dirty || saving} onClick={save}>
                      {saving && <Loader2 className="size-4 animate-spin" />} Kaydet
                    </Button>
                  </div>
                )}
              </div>

              {locked && (
                <div className="flex items-start gap-2 border-b border-border bg-warning/10 p-3 text-xs">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <p>
                    Süper yönetici rolü sistemin kilidini açık tutar ve yetki kontrollerini her zaman geçer.
                    Kısıtlamak sahte bir güvenlik hissi yaratacağı için değiştirilemez.
                  </p>
                </div>
              )}

              <div className="max-h-[62vh] space-y-4 overflow-y-auto p-4">
                {Object.entries(catalog).map(([group, permissions]) => {
                  const keys = Object.keys(permissions);
                  const onCount = keys.filter((k) => draft?.has(k)).length;

                  return (
                    <div key={group}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-bold">{group}</p>
                        <button
                          onClick={() => toggleGroup(group)}
                          disabled={locked}
                          className="text-[11px] text-brand hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                        >
                          {onCount === keys.length ? 'Tümünü kaldır' : 'Tümünü seç'} ({onCount}/{keys.length})
                        </button>
                      </div>

                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {Object.entries(permissions).map(([key, label]) => {
                          const on = locked || Boolean(draft?.has(key));

                          return (
                            <button
                              key={key}
                              onClick={() => toggle(key)}
                              disabled={locked}
                              className={cn(
                                'flex items-start gap-2 rounded-lg border p-2 text-left transition-colors',
                                on ? 'border-brand/50 bg-brand-soft' : 'border-border hover:border-brand/30',
                                locked && 'cursor-not-allowed opacity-70',
                              )}
                            >
                              <span
                                className={cn(
                                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                                  on ? 'border-brand bg-brand text-white' : 'border-input',
                                )}
                              >
                                {on && <Check className="size-3" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-medium">{label}</span>
                                <code className="block text-[10px] text-muted-foreground">{key}</code>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Yeni rol */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!saving) setCreateOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Rol</DialogTitle>
            <DialogDescription>
              Rol, şu an ekranda seçili {selected ? `"${ROLE_LABELS[selected.name] ?? selected.name}"` : ''} rolünün
              yetkileriyle oluşturulur; sonra istediğiniz gibi düzenlersiniz.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Rol Adı <span className="text-destructive">*</span></label>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Örn. kargo-sorumlusu"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Boşluklar tireye çevrilir; ad sistemde benzersiz olmalıdır.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button variant="deal" onClick={createRole} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`"${deleteTarget?.name}" rolünü sil`}
        description="Bu role sahip kullanıcı varsa sunucu silmeyi reddeder; önce onları başka bir role taşıyın."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          await adminApi.delete(`/roles/${deleteTarget?.id}`);
          setSelectedId(null);
          refetch();
        }}
        successMessage="Rol silindi."
      />
    </div>
  );
}
