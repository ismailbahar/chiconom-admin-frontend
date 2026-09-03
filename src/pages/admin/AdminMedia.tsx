import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check, Copy, Download, FolderPlus, HardDrive, Image as ImageIcon, Link2,
  Loader2, Search, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader, { StatCard } from '@/components/panel/PageHeader';
import ConfirmDialog from '@/components/panel/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import SmartImage from '@/components/SmartImage';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';

interface MediaFile {
  id: number;
  name: string;
  url: string;
  /** Izgara için küçük önizleme; yoksa sunucu `url` ile aynı değeri döner. */
  thumb: string;
  path: string;
  mime: string;
  extension: string;
  size: number;
  human_size: string;
  width: number | null;
  height: number | null;
  is_converted: boolean;
  original_extension: string | null;
  saving_percent: number | null;
  alt: string | null;
  folder: string | null;
  created_at: string;
}

interface Folder { id: number; name: string; path: string; parent_id: number | null }

interface Response {
  data: MediaFile[];
  meta: { current_page: number; last_page: number; total: number };
  folders: Folder[];
  roots: string[];
  stats: { total_files: number; total_size: number; saved_bytes: number };
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/**
 * MEDYA MERKEZİ.
 *
 * Yüklenen her görsel sunucuda WebP'e çevrilir; kazanılan yer "saving_percent"
 * ile rozet olarak gösterilir. Klasör ağacı ürün/kategori/banner ayrımını
 * korur; böylece aynı ad taşıyan dosyalar birbirini ezmez.
 */
export default function AdminMedia() {
  const [folder, setFolder] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [urlOpen, setUrlOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alt, setAlt] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Medya Merkezi — Yönetim';
  }, []);

  const { data, isLoading, refetch } = useQuery<Response>({
    queryKey: ['admin-media', folder, search, page],
    queryFn: async () => (await adminApi.get('/media', {
      params: { folder: folder || undefined, q: search || undefined, page, per_page: 40 },
    })).data,
  });

  useEffect(() => { setPage(1); }, [folder, search]);
  useEffect(() => { if (selected) setAlt(selected.alt ?? ''); }, [selected]);

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setProgress(0);

    const form = new FormData();
    list.slice(0, 20).forEach((file) => form.append('files[]', file));
    if (folder) form.append('folder', folder);

    try {
      const { data: res } = await adminApi.post('/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      toast.success(res.message);

      if (res.failed?.length) {
        res.failed.forEach((f: { name: string; error: string }) => toast.error(`${f.name}: ${f.error}`));
      }

      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInput.current) fileInput.current.value = '';
    }
  }, [folder, refetch]);

  const saveAlt = async () => {
    if (!selected) return;

    setBusy(true);

    try {
      const { data: res } = await adminApi.patch(`/media/${selected.id}`, { alt });
      toast.success(res.message);
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Bağlantı panoya kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı; bağlantıyı elle seçin.');
    }
  };

  const files = data?.data ?? [];
  const stats = data?.stats;

  return (
    <div>
      <PageHeader
        title="Medya Merkezi"
        description="Yüklenen görseller otomatik WebP'e çevrilir; boyut kazancı her dosyada rozet olarak görünür."
        icon={ImageIcon}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setUrlOpen(true)}>
              <Link2 className="size-4" /> URL'den Aktar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFolderOpen(true)}>
              <FolderPlus className="size-4" /> Klasör
            </Button>
            <Button variant="deal" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? `%${progress}` : 'Dosya Yükle'}
            </Button>
          </>
        }
      />

      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*,.pdf,.xlsx,.xml,.csv"
        className="hidden"
        onChange={(e) => e.target.files && upload(e.target.files)}
      />

      {stats && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Toplam Dosya" value={formatNumber(stats.total_files)} icon={ImageIcon} tone="brand" />
          <StatCard label="Kapladığı Yer" value={humanBytes(stats.total_size)} icon={HardDrive} />
          <StatCard
            label="WebP ile Kazanılan"
            value={humanBytes(stats.saved_bytes)}
            hint={stats.total_size > 0 ? `Dönüşüm olmasa ${humanBytes(stats.total_size + stats.saved_bytes)} olurdu` : undefined}
            icon={Sparkles}
            tone="success"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Klasörler */}
        <aside className="space-y-1">
          <button
            onClick={() => setFolder('')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              folder === '' ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <ImageIcon className="size-4" /> Tüm Dosyalar
          </button>

          {(data?.folders ?? []).map((f) => (
            <button
              key={f.id}
              onClick={() => setFolder(f.path)}
              style={{ paddingLeft: 12 + f.path.split('/').length * 8 }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm transition-colors',
                folder === f.path ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </aside>

        {/* Izgara */}
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dosya adı veya alt metni ara…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
            <span className="text-xs text-muted-foreground">{formatNumber(data?.meta.total ?? 0)} dosya</span>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
            className={cn(
              'min-h-[45vh] rounded-xl border-2 border-dashed p-3 transition-colors',
              dragging ? 'border-brand bg-brand-soft' : 'border-border bg-card',
            )}
          >
            {isLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-brand" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
                <Upload className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Bu klasörde dosya yok. Dosyaları buraya sürükleyip bırakabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setSelected(file)}
                    className="group overflow-hidden rounded-xl border border-border bg-background text-left transition-colors hover:border-brand"
                  >
                    {/*
                      Izgarada ÖNİZLEME kullanılır. Tam boyutlu görselle 100
                      dosyalık bir klasör onlarca MB indiriyordu; önizleme
                      tipik olarak onda biri kadar.
                    */}
                    <div className="relative aspect-square bg-secondary/30">
                      {file.mime.startsWith('image/') ? (
                        <SmartImage src={file.thumb ?? file.url} alt={file.alt ?? file.name} imgClassName="object-contain p-2" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-xs font-bold uppercase text-muted-foreground">{file.extension}</span>
                        </div>
                      )}

                      {file.is_converted && file.saving_percent != null && file.saving_percent > 0 && (
                        <Badge variant="success" className="absolute left-1.5 top-1.5 text-[10px]">
                          WebP −%{Math.round(file.saving_percent)}
                        </Badge>
                      )}
                    </div>

                    <div className="p-2">
                      <p className="truncate text-xs font-medium">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {file.human_size}
                        {file.width ? ` · ${file.width}×${file.height}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(data?.meta.last_page ?? 1) > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Önceki
              </Button>
              <span className="text-xs text-muted-foreground">
                {data?.meta.current_page} / {data?.meta.last_page}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (data?.meta.last_page ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dosya detayı */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate">{selected?.name}</DialogTitle>
            <DialogDescription>
              Alt metin görme engelli kullanıcılar ve arama motorları için kullanılır; ürün görsellerinde doldurun.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-border bg-secondary/20">
                {selected.mime.startsWith('image/') ? (
                  <img src={selected.url} alt={selected.alt ?? selected.name} className="max-h-[45vh] w-full object-contain" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    Önizlenemeyen dosya türü ({selected.extension})
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {[
                  ['Boyut', selected.human_size],
                  ['Ölçü', selected.width ? `${selected.width}×${selected.height}` : '—'],
                  ['Tür', selected.mime],
                  ['Klasör', selected.folder ?? '—'],
                  ['Yüklenme', formatDateTime(selected.created_at)],
                  ['Orijinal', selected.original_extension ? `.${selected.original_extension}` : '—'],
                  ['Kazanç', selected.saving_percent != null ? `%${Math.round(selected.saving_percent)}` : '—'],
                  ['Dönüştürüldü', selected.is_converted ? 'Evet (WebP)' : 'Hayır'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-muted/50 p-2">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="truncate font-medium">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Alt Metin</label>
                <Input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Görselin kısa açıklaması" />
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                <code className="min-w-0 flex-1 truncate text-xs">{selected.url}</code>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => copyUrl(selected.url)}>
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </Button>
                <a href={selected.url} download target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="icon" className="size-8"><Download className="size-4" /></Button>
                </a>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => { setDeleteTarget(selected); }}
            >
              <Trash2 className="size-4" /> Sil
            </Button>
            <Button variant="outline" onClick={() => setSelected(null)}>Kapat</Button>
            <Button variant="deal" onClick={saveAlt} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Yeni klasör */}
      <Dialog open={folderOpen} onOpenChange={(open) => { if (!busy) setFolderOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Klasör</DialogTitle>
            <DialogDescription>
              {folder ? <>Klasör <code className="rounded bg-muted px-1">{folder}</code> altında oluşturulur.</> : 'Kök dizinde oluşturulur.'}
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Örn. kampanya-gorselleri"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)} disabled={busy}>Vazgeç</Button>
            <Button
              variant="deal"
              disabled={busy || folderName.trim().length < 2}
              onClick={async () => {
                setBusy(true);

                try {
                  const parent = data?.folders.find((f) => f.path === folder);
                  const { data: res } = await adminApi.post('/media-folders', {
                    name: folderName.trim(),
                    parent_id: parent?.id ?? null,
                  });

                  toast.success(res.message);
                  setFolderOpen(false);
                  setFolderName('');
                  refetch();
                } catch (error) {
                  toast.error(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URL'den içe aktar */}
      <Dialog open={urlOpen} onOpenChange={(open) => { if (!busy) setUrlOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>URL'den Görsel Aktar</DialogTitle>
            <DialogDescription>
              Dış bağlantıdaki görsel indirilir, WebP'e çevrilir ve medya merkezine kaydedilir.
              XML/Excel toplu ürün yüklemelerinde de aynı akış kullanılır.
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://…/gorsel.jpg"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlOpen(false)} disabled={busy}>Vazgeç</Button>
            <Button
              variant="deal"
              disabled={busy || !importUrl.startsWith('http')}
              onClick={async () => {
                setBusy(true);

                try {
                  const { data: res } = await adminApi.post('/media/import-url', {
                    url: importUrl.trim(),
                    folder: folder || undefined,
                  });

                  toast.success(res.message);
                  setUrlOpen(false);
                  setImportUrl('');
                  refetch();
                } catch (error) {
                  toast.error(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Aktar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Dosyayı sil"
        description="Dosya diskten de silinir. Bu görseli kullanan ürün veya banner varsa görselleri boş kalır."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          await adminApi.delete(`/media/${deleteTarget?.id}`);
          setSelected(null);
          refetch();
        }}
        successMessage="Dosya silindi."
      />
    </div>
  );
}
