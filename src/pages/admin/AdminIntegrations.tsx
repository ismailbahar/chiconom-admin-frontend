import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Check, KeyRound, Loader2, Plug, RotateCcw, ShieldCheck, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn } from '@/lib/utils';

interface Field {
  key: string;
  label: string;
  hint: string | null;
  secret: boolean;
  filled: boolean;
  value: string | null;
  masked: string | null;
  source: 'panel' | 'env' | 'bos';
}

interface Integration {
  key: string;
  label: string;
  doc: string | null;
  configured: boolean;
  fields: Field[];
}

interface Response {
  data: Integration[];
  notice: string;
}

/** Hangi entegrasyonun bağlantı testi hangi uca gider. */
const TEST_ENDPOINT: Record<string, { url: string; body?: Record<string, unknown> }> = {
  iyzico: { url: '/test/payment', body: { provider: 'iyzico' } },
  moka: { url: '/test/payment', body: { provider: 'moka' } },
  paytr: { url: '/test/payment', body: { provider: 'paytr' } },
};

const SOURCE_LABEL: Record<Field['source'], string> = {
  panel: 'panelden',
  env: 'sunucudan (.env)',
  bos: 'girilmemiş',
};

/**
 * ENTEGRASYON KİMLİK BİLGİLERİ.
 *
 * POS, kargo, SMS, e-fatura ve SMTP anahtarları buradan girilir. Değerler
 * şifrelenerek saklanır ve BİR DAHA GÖRÜNTÜLENEMEZ — yalnız son dört karakteri
 * gösterilir. Bu bilinçlidir: yöneticinin oturumu ele geçirilse bile anahtar
 * okunamaz, ancak üzerine yazılabilir. Sızdırma geri alınamaz, üzerine yazma
 * alınabilir ve her değişiklik bildirime düşer.
 *
 * Boş bırakılan alan DEĞİŞMEZ. Sadece bir alanı güncellemek için diğerlerini
 * yeniden yazmak gerekmez; silmek için satırdaki çöp kutusu kullanılır.
 */
export default function AdminIntegrations() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Entegrasyonlar — Yönetim';
  }, []);

  const { data, isLoading } = useQuery<Response>({
    queryKey: ['integration-credentials'],
    queryFn: async () => (await adminApi.get('/integrations/credentials')).data,
  });

  const kaydet = useMutation({
    mutationFn: async ({ key, fields, clear }: { key: string; fields?: Record<string, string>; clear?: string[] }) =>
      (await adminApi.put(`/integrations/credentials/${key}`, { fields, clear })).data,
    onSuccess: (res, vars) => {
      toast.success(res.message);
      setDrafts((d) => ({ ...d, [vars.key]: {} }));
      qc.invalidateQueries({ queryKey: ['integration-credentials'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const testEt = async (key: string) => {
    const hedef = TEST_ENDPOINT[key];

    if (!hedef) {
      toast.info('Bu entegrasyon için otomatik bağlantı testi yok.');
      return;
    }

    setTesting(key);

    try {
      const { data: res } = await adminApi.post(hedef.url, hedef.body);
      toast.success(res.message ?? 'Bağlantı başarılı.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTesting(null);
    }
  };

  const setDraft = (grup: string, alan: string, deger: string) =>
    setDrafts((d) => ({ ...d, [grup]: { ...(d[grup] ?? {}), [alan]: deger } }));

  return (
    <div>
      <PageHeader
        title="Entegrasyonlar"
        description="Sanal POS, kargo, SMS, e-fatura ve e-posta sunucusu bilgileri."
        icon={Plug}
      />

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3.5 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="space-y-1">
          <p>{data?.notice}</p>
          <p className="text-xs text-muted-foreground">
            Her değişiklik kayda geçer ve bildirime düşer. Bu ekranın yetkisi
            (<span className="font-mono">settings.manage</span>) yalnız güvendiğiniz
            kişilerde olmalıdır — POS anahtarını değiştirebilen, ödemeleri
            yönlendirebilir.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {data!.data.map((grup) => {
            const taslak = drafts[grup.key] ?? {};
            const degisenVar = Object.values(taslak).some((v) => v !== '');

            return (
              <div key={grup.key} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-black">{grup.label}</h2>
                    {grup.configured
                      ? <Badge variant="success" className="gap-1"><Check className="size-3" /> kurulu</Badge>
                      : <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> eksik</Badge>}
                  </div>

                  <div className="flex items-center gap-2">
                    {TEST_ENDPOINT[grup.key] && (
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        disabled={!grup.configured || testing === grup.key}
                        onClick={() => testEt(grup.key)}
                      >
                        {testing === grup.key
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <Plug className="size-3.5" />}
                        Bağlantıyı Test Et
                      </Button>
                    )}

                    <Button
                      size="sm"
                      disabled={!degisenVar || kaydet.isPending}
                      onClick={() => kaydet.mutate({
                        key: grup.key,
                        fields: Object.fromEntries(
                          Object.entries(taslak).filter(([, v]) => v !== ''),
                        ),
                      })}
                    >
                      Kaydet
                    </Button>
                  </div>
                </div>

                {grup.doc && (
                  <p className="mb-3 text-xs text-muted-foreground">{grup.doc}</p>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  {grup.fields.map((alan) => (
                    <div key={alan.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <label className="text-xs font-semibold">{alan.label}</label>
                        <span className={cn(
                          'text-[10px]',
                          alan.source === 'bos' ? 'text-warning' : 'text-muted-foreground',
                        )}>
                          {SOURCE_LABEL[alan.source]}
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        <Input
                          type={alan.secret ? 'password' : 'text'}
                          autoComplete="new-password"
                          value={taslak[alan.key] ?? (alan.secret ? '' : alan.value ?? '')}
                          onChange={(e) => setDraft(grup.key, alan.key, e.target.value)}
                          placeholder={alan.secret
                            ? (alan.masked ?? 'Girilmemiş')
                            : 'Girilmemiş'}
                          className="font-mono text-xs"
                        />

                        {/*
                          Silme ayrı bir işlemdir. "Boş bırak, silinsin"
                          tasarımı, boş bırakmanın en sık yapılan şey olduğu
                          bir formda çalışan POS'u durdurur.
                        */}
                        {alan.source === 'panel' && (
                          <Button
                            variant="outline" size="icon" className="shrink-0"
                            title="Panelden kaldır — sunucudaki (.env) değere dön"
                            onClick={() => {
                              if (!confirm(`"${alan.label}" panelden silinecek ve sunucudaki (.env) değer geçerli olacak. Onaylıyor musunuz?`)) return;
                              kaydet.mutate({ key: grup.key, clear: [alan.key] });
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>

                      {alan.hint && (
                        <p className="mt-1 text-[10px] text-muted-foreground">{alan.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm">
        <RotateCcw className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>
          <strong>APP_KEY değiştirilmemelidir.</strong> Buradaki değerler sunucudaki
          uygulama anahtarıyla şifrelenir; anahtar yenilenirse tüm entegrasyon
          bilgileri okunamaz hâle gelir ve yeniden girilmesi gerekir.
        </p>
      </div>
    </div>
  );
}
