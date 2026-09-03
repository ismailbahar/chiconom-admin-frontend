import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, FolderTree, GripVertical, Loader2, Pencil,
  Plus, Search, Trash2,
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
import { Switch } from '@/components/ui/switch';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { usePanelAuthStore } from '@/stores/panelAuthStore';
import { cn, formatNumber } from '@/lib/utils';

interface Node {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  depth: number;
  is_active: boolean;
  product_count: number;
  children: Node[];
}

interface FormState {
  id: number | null;
  parent_id: number | null;
  name: string;
  icon: string;
  image: string;
  description: string;
  is_active: boolean;
  show_in_menu: boolean;
  show_in_home: boolean;
  meta_title: string;
  meta_description: string;
}

const EMPTY: FormState = {
  id: null, parent_id: null, name: '', icon: '', image: '', description: '',
  is_active: true, show_in_menu: true, show_in_home: false,
  meta_title: '', meta_description: '',
};

const DEPTH_LABELS = ['Ana Kategori', 'Alt Kategori', 'Alt-Alt Kategori'];

/** Ağacı düzleştirir — arama ve sürükle-bırak hesapları düz liste ister. */
function flatten(nodes: Node[], acc: Node[] = []): Node[] {
  for (const node of nodes) {
    acc.push(node);
    flatten(node.children, acc);
  }
  return acc;
}

/**
 * Kategori ağacı — Moda → Erkek Giyim → Erkek Tişört.
 *
 * Sıralama SÜRÜKLE-BIRAK ile değişir. Sürükleme yalnız AYNI EBEVEYN altında
 * serbesttir: farklı seviyeye taşımak için düzenleme kutusundaki "üst kategori"
 * alanı kullanılır. Bunun sebebi, sürüklerken yanlışlıkla derinlik değiştirip
 * ürünlerin filtre ağacını bozmayı engellemektir.
 */
export default function AdminCategories() {
  const can = usePanelAuthStore((s) => s.can);
  const editable = can('categories.manage');

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Node | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropId, setDropId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  /** Sürükleme sırasında sıra yerel olarak değişir; kaydetme sonrası sunucu doğrular. */
  const localTree = useRef<Node[] | null>(null);

  const { data, isLoading, refetch } = useQuery<Node[]>({
    queryKey: ['admin-category-tree'],
    queryFn: async () => (await adminApi.get('/categories/tree')).data.data,
  });

  useEffect(() => {
    document.title = 'Kategoriler — Yönetim';
  }, []);

  const tree = localTree.current ?? data ?? [];
  const flat = useMemo(() => flatten(tree), [tree]);

  const stats = useMemo(() => ({
    total: flat.length,
    l1: flat.filter((n) => n.depth === 0).length,
    l2: flat.filter((n) => n.depth === 1).length,
    l3: flat.filter((n) => n.depth >= 2).length,
    passive: flat.filter((n) => !n.is_active).length,
  }), [flat]);

  /** Arama açıkken eşleşenlerin tüm atalarını açık tut. */
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    if (!term) return null;
    return new Set(flat.filter((n) => n.name.toLocaleLowerCase('tr-TR').includes(term)).map((n) => n.id));
  }, [search, flat]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(flat.map((n) => n.id)));
  const collapseAll = () => setExpanded(new Set());

  const openNew = (parent: Node | null) => {
    setForm({ ...EMPTY, parent_id: parent?.id ?? null });
  };

  const openEdit = async (node: Node) => {
    // Ağaç ucu yalın alanlar döner; düzenleme için tam kaydı çekiyoruz
    try {
      const { data: res } = await adminApi.get('/categories', { params: { filter_slug: node.slug, per_page: 1 } });
      const row = res.data?.[0];

      setForm({
        ...EMPTY,
        id: node.id,
        parent_id: row?.parent_id ?? null,
        name: node.name,
        icon: row?.icon ?? '',
        image: row?.image ?? '',
        is_active: row?.is_active ?? node.is_active,
        show_in_menu: row?.show_in_menu ?? true,
        show_in_home: row?.show_in_home ?? false,
        description: '',
        meta_title: '',
        meta_description: '',
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const save = async () => {
    if (!form) return;

    if (form.name.trim().length < 2) {
      toast.error('Kategori adı en az 2 karakter olmalı.');
      return;
    }

    setSaving(true);

    const payload = {
      parent_id: form.parent_id,
      name: form.name.trim(),
      icon: form.icon || null,
      image: form.image || null,
      description: form.description || null,
      is_active: form.is_active,
      show_in_menu: form.show_in_menu,
      show_in_home: form.show_in_home,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
    };

    try {
      const { data: res } = form.id
        ? await adminApi.patch(`/categories/${form.id}`, payload)
        : await adminApi.post('/categories', payload);

      toast.success(res.message);
      setForm(null);
      localTree.current = null;
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /** Sürükleneni hedefin yerine taşır (yalnız aynı ebeveyn içinde). */
  const handleDrop = async (target: Node) => {
    if (dragId === null || dragId === target.id) { setDragId(null); setDropId(null); return; }

    const siblingsOf = (nodes: Node[], id: number): Node[] | null => {
      if (nodes.some((n) => n.id === id)) return nodes;
      for (const n of nodes) {
        const found = siblingsOf(n.children, id);
        if (found) return found;
      }
      return null;
    };

    const source = siblingsOf(tree, dragId);
    const destination = siblingsOf(tree, target.id);

    setDragId(null);
    setDropId(null);

    if (!source || !destination || source !== destination) {
      toast.error('Kategoriler yalnız aynı üst kategori altında sıralanabilir. Seviye değiştirmek için düzenleyin.');
      return;
    }

    const from = source.findIndex((n) => n.id === dragId);
    const to = source.findIndex((n) => n.id === target.id);
    const moved = [...source];
    moved.splice(to, 0, ...moved.splice(from, 1));

    // Yerel ağacı hemen güncelle (sunucu yanıtını beklemeden görünsün)
    source.length = 0;
    source.push(...moved);
    localTree.current = [...tree];

    setReordering(true);

    try {
      await adminApi.post('/categories/reorder', {
        items: moved.map((n, index) => ({ id: n.id, sort_order: index + 1 })),
      });
      toast.success('Sıralama kaydedildi.');
    } catch (error) {
      toast.error(errorMessage(error));
      localTree.current = null;
      refetch();
    } finally {
      setReordering(false);
    }
  };

  const renderNode = (node: Node) => {
    const isOpen = expanded.has(node.id) || Boolean(matches);
    const hidden = matches && !matches.has(node.id) && !flatten(node.children).some((c) => matches.has(c.id));

    if (hidden) return null;

    return (
      <div key={node.id}>
        <div
          draggable={editable}
          onDragStart={() => setDragId(node.id)}
          onDragOver={(e) => { e.preventDefault(); setDropId(node.id); }}
          onDragLeave={() => setDropId((id) => (id === node.id ? null : id))}
          onDrop={() => handleDrop(node)}
          onDragEnd={() => { setDragId(null); setDropId(null); }}
          className={cn(
            'group flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors',
            'hover:border-border hover:bg-muted/40',
            dragId === node.id && 'opacity-40',
            dropId === node.id && dragId !== node.id && 'border-brand bg-brand-soft',
          )}
          style={{ marginLeft: node.depth * 22 }}
        >
          {editable && (
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" />
          )}

          <button
            onClick={() => toggle(node.id)}
            className={cn('shrink-0 text-muted-foreground', node.children.length === 0 && 'invisible')}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>

          {node.icon && <span className="shrink-0 text-sm">{node.icon}</span>}

          <span className={cn('min-w-0 flex-1 truncate text-sm', !node.is_active && 'text-muted-foreground line-through')}>
            {node.name}
          </span>

          <Badge variant="outline" className="shrink-0 text-[10px]">{DEPTH_LABELS[node.depth] ?? `Seviye ${node.depth + 1}`}</Badge>

          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground" title="Bu kategori ve altındaki ürün sayısı">
            {formatNumber(node.product_count)} ürün
          </span>

          {editable && (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {node.depth < 2 && (
                <Button variant="ghost" size="icon" className="size-7" title="Alt kategori ekle" onClick={() => openNew(node)}>
                  <Plus className="size-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-7" title="Düzenle" onClick={() => openEdit(node)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                title="Sil"
                onClick={() => setDeleteTarget(node)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {isOpen && node.children.map(renderNode)}
      </div>
    );
  };

  /** Üst kategori seçici — kendini ve alt ağacını listeden çıkarır (döngü olmasın). */
  const parentOptions = useMemo(() => {
    if (!form) return [];

    const excluded = new Set<number>();

    if (form.id) {
      const self = flat.find((n) => n.id === form.id);
      if (self) {
        excluded.add(self.id);
        flatten(self.children).forEach((n) => excluded.add(n.id));
      }
    }

    // 3 seviye kuralı: en alt seviye kategoriler ebeveyn olamaz
    return flat.filter((n) => !excluded.has(n.id) && n.depth < 2);
  }, [form, flat]);

  return (
    <div>
      <PageHeader
        title="Kategoriler"
        description="Üç seviyeli kategori ağacı. Sıralamak için satırları sürükleyin, seviye değiştirmek için düzenleyin."
        icon={FolderTree}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={expandAll}>Tümünü Aç</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Tümünü Kapat</Button>
            {editable && (
              <Button variant="deal" size="sm" onClick={() => openNew(null)}>
                <Plus className="size-4" /> Ana Kategori
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Toplam', value: stats.total },
          { label: 'Ana Kategori', value: stats.l1 },
          { label: 'Alt Kategori', value: stats.l2 },
          { label: 'Alt-Alt Kategori', value: stats.l3 },
          { label: 'Pasif', value: stats.passive },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-black tabular-nums">{formatNumber(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kategori ara… (arama sırasında ağaç tamamen açılır)"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          {reordering && <Loader2 className="size-4 animate-spin text-brand" />}
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-brand" />
            </div>
          ) : tree.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz kategori yok.</p>
          ) : (
            tree.map(renderNode)
          )}
        </div>
      </div>

      {/* ── Ekle / düzenle ────────────────────────────────────────── */}
      <Dialog open={Boolean(form)} onOpenChange={(open) => { if (!open && !saving) setForm(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}</DialogTitle>
            <DialogDescription>
              Üst kategori seçilmezse ana kategori olarak eklenir. Ürünler yalnız en alt seviyedeki kategoriye bağlanır.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Üst Kategori</label>
                <select
                  value={form.parent_id ?? ''}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : null })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Ana kategori (en üst seviye) —</option>
                  {parentOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      {'— '.repeat(n.depth)}{n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Kategori Adı <span className="text-destructive">*</span>
                </label>
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Örn. Erkek Tişört"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Simge (emoji)</label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="👕"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Görsel URL</label>
                <Input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="/storage/kategori/…webp"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">SEO Başlık</label>
                  <Input
                    value={form.meta_title}
                    onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                    placeholder="Boşsa kategori adı kullanılır"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">SEO Açıklama</label>
                  <Input
                    value={form.meta_description}
                    onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                {([
                  ['is_active', 'Yayında', 'Kapalıysa vitrinde ve filtrelerde görünmez.'],
                  ['show_in_menu', 'Menüde göster', 'Üst menü ve kategori ağacında listelenir.'],
                  ['show_in_home', 'Anasayfada göster', 'Anasayfadaki kategori şeridinde yer alır.'],
                ] as const).map(([key, label, hint]) => (
                  <label key={key} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">{hint}</span>
                    </span>
                    <Switch
                      checked={form[key]}
                      onCheckedChange={(checked) => setForm({ ...form, [key]: checked })}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Vazgeç</Button>
            <Button variant="deal" onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`"${deleteTarget?.name}" kategorisini sil`}
        description="Alt kategorisi veya ürünü olan kategoriler silinemez; sunucu bunu ayrıca doğrular."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          await adminApi.delete(`/categories/${deleteTarget?.id}`);
          localTree.current = null;
          refetch();
        }}
        successMessage="Kategori silindi."
      />
    </div>
  );
}
