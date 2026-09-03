import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Check, Eye, History, Loader2, Lock, Save, ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn, formatNumber } from '@/lib/utils';

interface Version {
  id: number;
  version: number;
  is_active: boolean;
  audience: string | null;
  effective_from: string | null;
  acceptance_count: number;
  updated_at: string;
}

interface Group {
  key: string;
  label: string;
  current: { id: number; version: number; title: string; effective_from: string | null } | null;
  versions: Version[];
}

/** Sunucudaki `audience` sütunu yalnız bu iki değeri alır (customer | both). */
const AUDIENCE = {
  customer: 'Müşteri',
  both: 'Herkes',
} as Record<string, string>;

/**
 * SÖZLEŞME METİNLERİ.
 *
 * Mesafeli satış sözleşmesi, ön bilgilendirme formu, KVKK aydınlatma metni
 * ve diğerleri buradan yönetilir. Bu ana kadar panelde hiç ekranı yoktu:
 * metinler yalnız veritabanına elle girilerek değiştirilebiliyordu — yani
 * avukat düzeltmesi geldiğinde uygulanamıyordu.
 *
 * SÜRÜMLEME NEDEN ZORUNLU
 *
 * Müşterinin sipariş anında KABUL ETTİĞİ metin, bugünkü metin değildir.
 * Uyuşmazlıkta "hangi metni onayladı" sorusunun cevabı gerekir; bu yüzden
 * kabul edilmiş bir sürüm DEĞİŞTİRİLEMEZ, yalnız yeni sürüm açılabilir.
 * Eski sürüm arşivde kalır ve o sürümü kabul etmiş siparişlere bağlı olmayı
 * sürdürür (bkz. contract_acceptances).
 *
 * Ekran bu kuralı gizlemez: kabul sayısı olan sürümde metin alanı kilitlenir
 * ve "yeni sürüm oluştur" yönlendirmesi yapılır.
 */
export default function AdminContracts() {
  const [seciliId, setSeciliId] = useState<number | null>(null);
  const [icerik, setIcerik] = useState('');
  const [baslik, setBaslik] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [onizleme, setOnizleme] = useState<string | null>(null);

  useEffect(() => { document.title = 'Sözleşmeler — Yönetim'; }, []);

  const { data, refetch } = useQuery<{ data: Group[] }>({
    queryKey: ['admin-contracts'],
    queryFn: async () => (await adminApi.get('/contracts')).data,
  });

  const gruplar = data?.data ?? [];

  /* İlk açılışta ilk sözleşmenin güncel sürümü seçili gelsin */
  useEffect(() => {
    if (seciliId === null && gruplar.length > 0 && gruplar[0].current) {
      setSeciliId(gruplar[0].current.id);
    }
  }, [gruplar, seciliId]);

  const { data: detay, isFetching } = useQuery({
    queryKey: ['admin-contract', seciliId],
    queryFn: async () => (await adminApi.get(`/contracts/${seciliId}`)).data,
    enabled: Boolean(seciliId),
  });

  useEffect(() => {
    if (!detay?.data) return;
    setIcerik(detay.data.content ?? '');
    setBaslik(detay.data.title ?? '');
    setDirty(false);
  }, [detay]);

  const t = detay?.data;
  const kabulSayisi = detay?.acceptance_count ?? 0;

  /**
   * Kilit, kabul sayısına bakar — is_active'e değil.
   *
   * Yayında olmayan ama bir zamanlar kabul edilmiş bir sürüm de
   * değiştirilemez; imzalanmış belgeyi geriye dönük düzenlemek olurdu.
   */
  const kilitli = kabulSayisi > 0;

  const kaydet = async () => {
    setSaving(true);

    try {
      const { data: res } = await adminApi.patch(`/contracts/${seciliId}`, {
        title: baslik, content: icerik,
      });

      toast.success(res.message);
      setDirty(false);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const yeniSurum = async () => {
    if (!confirm(
      `"${t?.title}" için yeni sürüm oluşturulacak (v${(t?.version ?? 0) + 1}).\n\n`
      + 'Mevcut sürüm arşivlenir ama silinmez; onu kabul etmiş siparişlere bağlı kalmaya devam eder.\n\n'
      + 'Devam edilsin mi?',
    )) return;

    setSaving(true);

    try {
      const { data: res } = await adminApi.post(`/contracts/${seciliId}/version`, {
        content: icerik, title: baslik,
      });

      toast.success(res.message);
      setSeciliId(res.data.id);
      setDirty(false);
      await refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const onizle = async () => {
    try {
      const { data: res } = await adminApi.post(`/contracts/${seciliId}/preview`, { content: icerik });
      setOnizleme(res.data.html);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Sözleşmeler"
        description="Mesafeli satış, ön bilgilendirme, KVKK ve diğer yasal metinler."
        icon={ScrollText}
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>
          Bu metinler mevzuata göre hazırlandı ancak <strong>hukukçu incelemesinden geçmedi</strong>.
          Yayına çıkmadan önce bir avukata okutun. Değişiklik yaptığınızda metin
          otomatik olarak yeni sürüm alır; eski sürümler arşivde kalır.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* ── Sol: sözleşme türleri ──────────────────────────────── */}
        <aside className="space-y-2">
          {gruplar.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border p-2.5">
                <p className="text-xs font-black">{g.label}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {g.current ? `Yayında: v${g.current.version}` : 'Yayında sürüm yok'}
                </p>
              </div>

              <div>
                {g.versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSeciliId(v.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/50',
                      seciliId === v.id && 'bg-brand-soft',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono font-bold">v{v.version}</span>
                      {v.is_active && <Badge variant="success" className="px-1 py-0 text-[9px]">yayında</Badge>}
                      {v.acceptance_count > 0 && <Lock className="size-3 text-muted-foreground" />}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {v.acceptance_count > 0 ? `${formatNumber(v.acceptance_count)} kabul` : '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* ── Sağ: düzenleyici ───────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4">
          {!t || isFetching ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black">{t.title}</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Sürüm {t.version} · {AUDIENCE[String(t.audience)] ?? 'Herkes'} ·
                    {t.is_active ? ' yayında' : ' arşiv'}
                    {t.effective_from && ` · yürürlük ${String(t.effective_from).slice(0, 10)}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={onizle}>
                    <Eye className="size-3.5" /> Önizle
                  </Button>

                  {kilitli ? (
                    <Button size="sm" className="gap-1.5" disabled={saving || !dirty} onClick={yeniSurum}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
                      Yeni sürüm oluştur
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" className="gap-1.5" disabled={saving || !dirty} onClick={kaydet}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {dirty ? 'Kaydet' : 'Kaydedildi'}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" disabled={saving} onClick={yeniSurum}>
                        <History className="size-3.5" /> Yeni sürüm
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {kilitli && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <p>
                    Bu sürümü <strong>{formatNumber(kabulSayisi)} kişi kabul etti</strong>, metni
                    değiştirilemez. Uyuşmazlıkta "müşteri hangi metni onayladı" sorusunun cevabı
                    bu kayıttır. Değişiklik için metni düzenleyip <strong>yeni sürüm</strong> oluşturun.
                  </p>
                </div>
              )}

              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold">Başlık</label>
                <Input
                  value={baslik}
                  onChange={(e) => { setBaslik(e.target.value); setDirty(true); }}
                />
              </div>

              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <label className="text-xs font-semibold">Metin</label>
                  <span className="text-[10px] text-muted-foreground">
                    HTML ve değişken kullanılabilir: {'{{ musteri_ad }}'}, {'{{ siparis_no }}'}, {'{{ tutar }}'}
                  </span>
                </div>

                <textarea
                  value={icerik}
                  onChange={(e) => { setIcerik(e.target.value); setDirty(true); }}
                  rows={26}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed
                             focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <p className="mt-1 text-[10px] text-muted-foreground">
                  {icerik.length.toLocaleString('tr-TR')} karakter ·
                  Önizleme, değişkenleri örnek verilerle doldurup gerçek hâlini gösterir.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Önizleme ─────────────────────────────────────────────── */}
      <Dialog open={onizleme !== null} onOpenChange={(o) => { if (!o) setOnizleme(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sözleşme önizlemesi</DialogTitle>
            <DialogDescription>
              Değişkenler örnek verilerle dolduruldu. Müşteri bu metni böyle görecek.
            </DialogDescription>
          </DialogHeader>

          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            /*
              İçerik yöneticinin kendi yazdığı metindir ve yalnız yöneticiye
              gösterilir; dışarıdan gelen bir veri değildir.
            */
            dangerouslySetInnerHTML={{ __html: onizleme ?? '' }}
          />

          <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
            <Check className="size-3.5 text-success" />
            Bu önizleme kaydedilmemiş metni de gösterir — kaydetmeden kontrol edebilirsiniz.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
