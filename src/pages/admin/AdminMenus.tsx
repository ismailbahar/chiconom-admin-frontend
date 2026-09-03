import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, ChevronUp, ExternalLink, FolderTree, Layers, Link2, Loader2,
  Menu as MenuIcon, Plus, Save, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn } from '@/lib/utils';

interface Item {
  id: number;
  parent_id: number | null;
  label: string;
  url: string | null;
  category_id: number | null;
  category: string | null;
  badge_text: string | null;
  badge_color: string | null;
  device: string;
  is_highlighted: boolean;
  open_new_tab: boolean;
  is_active: boolean;
  sort_order: number;
  children: Item[];
}

interface MenuRow {
  id: number;
  key: string;
  name: string;
  layout: string;
  items_count: number;
}

const DEVICE_LABEL: Record<string, string> = {
  all: 'Tümü', desktop: 'Masaüstü', mobile: 'Mobil',
};

/**
 * MENÜ YÖNETİMİ.
 *
 * Vitrinin header ve footer menüleri panelden hiç yönetilemiyordu; menü
 * değiştirmek veritabanına elle girmek demekti.
 *
 * SIRALAMA NEDEN SÜRÜKLE-BIRAK DEĞİL
 *
 * Sürükle-bırak, iç içe ağaçlarda hem dokunmatikte hem klavyeyle kullanımı
 * zor bir etkileşimdir ve yanlışlıkla başka bir dalın altına bırakmak çok
 * kolaydır. Yukarı/aşağı düğmeleri her cihazda ve her erişilebilirlik
 * aracında aynı çalışır; bir menüde on beş öğe varken hız farkı da yoktur.
 */
export default function AdminMenus() {
  const [seciliKey, setSeciliKey] = useState<string | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Item | 'yeni' | null>(null);
  const [ustId, setUstId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [ictenAktarOpen, setIctenAktarOpen] = useState(false);

  useEffect(() => { document.title = 'Menüler — Yönetim'; }, []);

  const { data: menuler } = useQuery<{ data: MenuRow[] }>({
    queryKey: ['admin-menus'],
    queryFn: async () => (await adminApi.get('/menus')).data,
  });

  useEffect(() => {
    if (!seciliKey && menuler?.data?.length) setSeciliKey(menuler.data[0].key);
  }, [menuler, seciliKey]);

  const { data: detay, isFetching, refetch } = useQuery({
    queryKey: ['admin-menu', seciliKey],
    queryFn: async () => (await adminApi.get(`/menus/${seciliKey}`)).data,
    enabled: Boolean(seciliKey),
  });

  const menu: MenuRow | undefined = detay?.data;
  const items: Item[] = detay?.items ?? [];

  const istek = async (fn: () => Promise<{ data: { message: string } }>) => {
    setBusy(true);

    try {
      const { data: res } = await fn();
      toast.success(res.message);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Kardeşler arasında yer değiştirir.
   *
   * Sunucuya TÜM kardeş listesi yeni sıralamasıyla gönderilir; tek bir
   * öğenin sort_order'ını değiştirmek, eşit sıralı öğeler oluştuğunda
   * beklenmedik sonuç verirdi.
   */
  const tasi = async (kardesler: Item[], index: number, yon: -1 | 1) => {
    const hedef = index + yon;
    if (hedef < 0 || hedef >= kardesler.length) return;

    const yeni = [...kardesler];
    [yeni[index], yeni[hedef]] = [yeni[hedef], yeni[index]];

    await istek(() => adminApi.post(`/menus/${menu!.id}/reorder`, {
      items: yeni.map((it, i) => ({ id: it.id, parent_id: it.parent_id, sort_order: i })),
    }));
  };

  const renderItems = (list: Item[], seviye = 0): React.ReactNode => list.map((item, i) => (
    <div key={item.id}>
      <div
        className={cn(
          'flex items-center gap-2 border-b border-border px-2 py-1.5 hover:bg-muted/30',
          !item.is_active && 'opacity-50',
        )}
        style={{ paddingLeft: 8 + seviye * 20 }}
      >
        <div className="flex shrink-0 flex-col">
          <button
            disabled={busy || i === 0}
            onClick={() => tasi(list, i, -1)}
            className="text-muted-foreground hover:text-brand disabled:opacity-20"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            disabled={busy || i === list.length - 1}
            onClick={() => tasi(list, i, 1)}
            className="text-muted-foreground hover:text-brand disabled:opacity-20"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{item.label}</span>

            {item.badge_text && (
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                style={{ background: item.badge_color ?? '#FF6A00' }}
              >
                {item.badge_text}
              </span>
            )}

            {item.is_highlighted && <Badge variant="deal" className="px-1 py-0 text-[9px]">vurgulu</Badge>}
            {item.device !== 'all' && (
              <Badge variant="secondary" className="px-1 py-0 text-[9px]">{DEVICE_LABEL[item.device]}</Badge>
            )}
            {!item.is_active && <Badge variant="outline" className="px-1 py-0 text-[9px]">kapalı</Badge>}
          </div>

          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {item.category ? <FolderTree className="size-3" /> : <Link2 className="size-3" />}
            {item.category ?? item.url ?? '—'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
            onClick={() => { setUstId(item.id); setDuzenlenen('yeni'); }}
          >
            <Plus className="size-3" /> Alt
          </Button>

          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setDuzenlenen(item)}>
            Düzenle
          </Button>

          <Button
            variant="ghost" size="icon" className="size-7" disabled={busy}
            onClick={() => {
              const altVar = item.children.length > 0;
              if (!confirm(altVar
                ? `"${item.label}" ve ${item.children.length} alt öğesi silinecek. Onaylıyor musunuz?`
                : `"${item.label}" silinecek. Onaylıyor musunuz?`)) return;
              istek(() => adminApi.delete(`/menu-items/${item.id}`));
            }}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {item.children.length > 0 && renderItems(item.children, seviye + 1)}
    </div>
  ));

  return (
    <div>
      <PageHeader
        title="Menüler"
        description="Vitrinin üst menüsü, mobil menü ve alt bilgi bağlantıları."
        icon={MenuIcon}
        actions={menu && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => setIctenAktarOpen(true)}>
              <FolderTree className="size-4" /> Kategorilerden Aktar
            </Button>
            <Button className="gap-1.5" onClick={() => { setUstId(null); setDuzenlenen('yeni'); }}>
              <Plus className="size-4" /> Öğe Ekle
            </Button>
          </div>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* ── Menü listesi ───────────────────────────────────────── */}
        <aside className="space-y-1.5">
          {(menuler?.data ?? []).map((m) => (
            <button
              key={m.key}
              onClick={() => setSeciliKey(m.key)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-colors',
                seciliKey === m.key
                  ? 'border-brand bg-brand-soft'
                  : 'border-border bg-card hover:border-brand/40',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-mono">{m.key}</span> · {m.layout}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">{m.items_count}</Badge>
            </button>
          ))}
        </aside>

        {/* ── Öğe ağacı ──────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isFetching ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
          ) : items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Layers className="size-6" />
              <p>Bu menüde öğe yok.</p>
              <p className="text-xs">
                Kategorileri toplu aktarabilir ya da tek tek öğe ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            renderItems(items)
          )}
        </div>
      </div>

      {duzenlenen && menu && (
        <ItemDialog
          menuId={menu.id}
          item={duzenlenen === 'yeni' ? null : duzenlenen}
          parentId={duzenlenen === 'yeni' ? ustId : null}
          onClose={() => { setDuzenlenen(null); setUstId(null); }}
          onSaved={refetch}
        />
      )}

      {ictenAktarOpen && menu && (
        <ImportDialog menuId={menu.id} onClose={() => setIctenAktarOpen(false)} onSaved={refetch} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

function ItemDialog({
  menuId, item, parentId, onClose, onSaved,
}: {
  menuId: number;
  item: Item | null;
  parentId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    label: item?.label ?? '',
    url: item?.url ?? '',
    category_id: item?.category_id ?? '',
    badge_text: item?.badge_text ?? '',
    badge_color: item?.badge_color ?? '#FF6A00',
    device: item?.device ?? 'all',
    is_highlighted: item?.is_highlighted ?? false,
    open_new_tab: item?.open_new_tab ?? false,
    is_active: item?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  const { data: kategoriler } = useQuery({
    queryKey: ['admin-menu-categories'],
    queryFn: async () => (await adminApi.get('/products/form-options')).data,
    staleTime: 300_000,
  });

  const kaydet = async () => {
    if (!form.label.trim() && !form.category_id) {
      toast.error('Etiket ya da kategori seçmelisiniz.');
      return;
    }

    setBusy(true);

    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        url: form.category_id ? null : (form.url || null),
        parent_id: item ? item.parent_id : parentId,
      };

      const { data: res } = item
        ? await adminApi.patch(`/menu-items/${item.id}`, payload)
        : await adminApi.post(`/menus/${menuId}/items`, payload);

      toast.success(res.message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Menü öğesini düzenle' : 'Yeni menü öğesi'}</DialogTitle>
          <DialogDescription>
            {parentId ? 'Seçilen öğenin altına eklenir.' : 'Menünün en üst seviyesine eklenir.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Kategori bağlantısı</span>
            <select
              value={String(form.category_id)}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Kategori bağlama (kendi bağlantımı gireceğim)</option>
              {(kategoriler?.categories ?? []).map((c: { id: number; name: string }) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Kategori seçilirse bağlantı ve etiket kendiliğinden doldurulur; kategori
              adı değişse bile menü doğru sayfaya gitmeye devam eder.
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Etiket</span>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={form.category_id ? 'Boş bırakılırsa kategori adı kullanılır' : 'Menüde görünecek yazı'}
            />
          </label>

          {!form.category_id && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Bağlantı</span>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="/kampanyalar veya https://…"
                className="font-mono text-xs"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Rozet metni</span>
              <Input
                value={form.badge_text}
                onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
                placeholder="YENİ, İNDİRİM…"
                maxLength={20}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Rozet rengi</span>
              <Input
                type="color" value={form.badge_color}
                onChange={(e) => setForm({ ...form, badge_color: e.target.value })}
                className="h-9 p-1"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Görüneceği cihaz</span>
            <select
              value={form.device}
              onChange={(e) => setForm({ ...form, device: e.target.value })}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tüm cihazlar</option>
              <option value="desktop">Yalnız masaüstü</option>
              <option value="mobile">Yalnız mobil</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-4">
            {([
              ['is_active', 'Yayında'],
              ['is_highlighted', 'Vurgulu göster'],
              ['open_new_tab', 'Yeni sekmede aç'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="size-4 accent-brand"
                />
                <span className="text-xs font-semibold">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Kategorileri menüye toplu aktarır.
 *
 * Elli kategoriyi tek tek eklemek yerine ağacın tamamı bir seferde gelir.
 * Derinlik sınırı vardır: üç seviyeden fazlası mega menüde okunmaz hâle
 * gelir ve mobilde hiç açılmaz.
 */
function ImportDialog({
  menuId, onClose, onSaved,
}: { menuId: number; onClose: () => void; onSaved: () => void }) {
  const [secili, setSecili] = useState<number[]>([]);
  const [derinlik, setDerinlik] = useState('2');
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ['admin-menu-categories'],
    queryFn: async () => (await adminApi.get('/products/form-options')).data,
    staleTime: 300_000,
  });

  const kategoriler: Array<{ id: number; name: string }> = data?.categories ?? [];

  /* Yalnız kök kategoriler seçilir; alt ağaç zaten derinlikle gelir */
  const kokler = kategoriler.filter((c) => !c.name.startsWith('—'));

  const aktar = async () => {
    if (secili.length === 0) return;

    setBusy(true);

    try {
      const { data: res } = await adminApi.post(`/menus/${menuId}/import-categories`, {
        category_ids: secili,
        with_children: true,
        max_depth: Number(derinlik),
      });

      toast.success(res.message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Kategorilerden menü oluştur</DialogTitle>
          <DialogDescription>
            Seçtiğiniz kategoriler alt ağaçlarıyla birlikte menüye eklenir.
          </DialogDescription>
        </DialogHeader>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Kaç seviye aktarılsın?</span>
          <select
            value={derinlik}
            onChange={(e) => setDerinlik(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="1">Yalnız ana kategoriler</option>
            <option value="2">İki seviye (önerilen)</option>
            <option value="3">Üç seviye</option>
          </select>
        </label>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2 scrollbar-thin">
          {kokler.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/40">
              <input
                type="checkbox"
                checked={secili.includes(c.id)}
                onChange={(e) => setSecili((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))}
                className="size-4 accent-brand"
              />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Vazgeç</Button>
          <Button onClick={aktar} disabled={busy || secili.length === 0} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
            {secili.length} kategoriyi aktar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
