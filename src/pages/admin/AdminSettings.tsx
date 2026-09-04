import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, CreditCard, Eye, Globe, Loader2, Mail, MessageSquare, Plug, Receipt,
  Save, Search, Settings as SettingsIcon, Share2, ShoppingCart, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { cn } from '@/lib/utils';

interface Item {
  key: string;
  label: string;
  description: string | null;
  type: string;
  is_public: boolean;
  is_encrypted: boolean;
  value: unknown;
}

type Groups = Record<string, Item[]>;

/** Sunucudaki AdminSettingController::integrations yanıtı. */
interface Integrations {
  payment: {
    default: string;
    /**
     * DİKKAT: nesne dizisidir, string dizisi değil. Daha önce string
     * varsayıldığı için kartta "[object Object], [object Object]" yazıyordu.
     */
    providers: Array<{ key: string; label: string; configured: boolean; is_default: boolean }>;
    test_mode: boolean;
    force_3d: boolean;
  };
  einvoice: { enabled: boolean; provider: string; test_mode: boolean; configured: boolean };
  shipping: { default: string; yurtici_enabled: boolean };
  sms: { enabled: boolean; provider: string; header: string };
  mail: { mailer: string; from: string };
}

/** Grup anahtarı → başlık + simge. Sunucudan gelmeyen grup varsa anahtarıyla gösterilir. */
const GROUP_META: Record<string, { label: string; icon: React.ElementType; hint?: string }> = {
  site: { label: 'Site Kimliği', icon: Globe, hint: 'Vitrinde görünen isim, iletişim ve marka bilgileri.' },
  social: { label: 'Sosyal Medya', icon: Share2, hint: 'Boş bırakılan hesaplar alt bilgide gizlenir.' },
  order: { label: 'Sipariş & Kargo', icon: ShoppingCart, hint: 'Ücretsiz kargo eşiği ve iade süresi mağaza geneli için geçerlidir.' },
  payment: { label: 'Ödeme', icon: CreditCard, hint: 'Sanal POS seçimi ve taksit sınırı.' },
  seo: { label: 'SEO & Analitik', icon: Search, hint: 'Google Analytics / GTM kimlikleri vitrine otomatik gömülür.' },
  invoice: { label: 'e-Fatura', icon: Receipt, hint: 'BirFatura entegrasyonu; API bilgileri ve otomatik kesim Entegrasyonlar ekranındadır.' },
  notification: { label: 'Bildirim', icon: Bell, hint: 'E-posta ve SMS gönderimi kuyruk üzerinden çalışır.' },
};

const GROUP_ORDER = ['site', 'social', 'order', 'payment', 'seo', 'invoice', 'notification'];

/**
 * Sistem ayarları.
 *
 * Değerler grup/anahtar çiftiyle saklanır. Şifreli alanlar (POS parolası, SMTP
 * parolası…) sunucudan MASKELİ (••••••••) gelir; kullanıcı dokunmazsa aynı
 * maske geri gönderilir ve sunucu bunu "değişmedi" sayar. Böylece parolalar
 * hiçbir zaman panele düz metin olarak inmez.
 */
export default function AdminSettings() {
  const [active, setActive] = useState('site');
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState<'mail' | 'sms' | null>(null);
  const [testTarget, setTestTarget] = useState('');
  const [testing, setTesting] = useState(false);
  const [posTesting, setPosTesting] = useState(false);

  /**
   * POS BAĞLANTI TESTİ.
   *
   * Sunucu tarafında BIN sorgusu yapılır — kimlik bilgisini, imzayı ve ağ
   * erişimini PARA HAREKETİ DOĞURMADAN sınayan tek yöntem budur. Sahte bir
   * çekim denemek POS tarafında başarısız işlem kaydı bırakırdı.
   */
  const testPayment = async () => {
    setPosTesting(true);

    try {
      const { data } = await adminApi.post('/test/payment');
      toast.success(data.message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPosTesting(false);
    }
  };

  useEffect(() => {
    document.title = 'Ayarlar — Yönetim';
  }, []);

  const { data, isLoading, refetch } = useQuery<Groups>({
    queryKey: ['admin-settings'],
    queryFn: async () => (await adminApi.get('/settings')).data.data,
  });

  const { data: integrations } = useQuery<Integrations>({
    queryKey: ['admin-integrations'],
    queryFn: async () => (await adminApi.get('/integrations')).data,
  });

  const groups = data ?? {};

  const groupKeys = useMemo(() => {
    const keys = Object.keys(groups);
    // Bilinen gruplar önce ve sabit sırada, bilinmeyenler sona
    return [
      ...GROUP_ORDER.filter((g) => keys.includes(g)),
      ...keys.filter((g) => !GROUP_ORDER.includes(g)),
    ];
  }, [groups]);

  useEffect(() => {
    if (groupKeys.length > 0 && !groupKeys.includes(active)) setActive(groupKeys[0]);
  }, [groupKeys, active]);

  const items = groups[active] ?? [];
  const path = (key: string) => `${active}.${key}`;

  const valueOf = (item: Item): unknown =>
    Object.prototype.hasOwnProperty.call(draft, path(item.key)) ? draft[path(item.key)] : item.value;

  const set = (item: Item, value: unknown) => setDraft((prev) => ({ ...prev, [path(item.key)]: value }));

  const dirtyCount = Object.keys(draft).length;

  const save = async () => {
    if (dirtyCount === 0) return;

    setSaving(true);

    const payload = Object.entries(draft).map(([full, value]) => {
      const [group, ...rest] = full.split('.');
      const key = rest.join('.');
      const item = groups[group]?.find((i) => i.key === key);

      return {
        group,
        key,
        // Sunucu boolean'ı 0/1 olarak saklıyor
        value: typeof value === 'boolean' ? (value ? '1' : '0') : value,
        type: item?.type ?? 'string',
      };
    });

    try {
      const { data: res } = await adminApi.put('/settings', { settings: payload });
      toast.success(res.message);
      setDraft({});
      refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!testOpen) return;

    setTesting(true);

    try {
      const { data: res } = await adminApi.post(`/test/${testOpen}`,
        testOpen === 'mail' ? { email: testTarget } : { phone: testTarget });

      toast.success(res.message);
      setTestOpen(null);
      setTestTarget('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  const meta = GROUP_META[active];

  return (
    <div>
      <PageHeader
        title="Ayarlar"
        description="Değişiklikler kaydedildiği anda tüm sitede geçerli olur; önbellek otomatik temizlenir."
        icon={SettingsIcon}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setTestOpen('mail')}>
              <Mail className="size-4" /> Test E-postası
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTestOpen('sms')}>
              <MessageSquare className="size-4" /> Test SMS
            </Button>
            <Button variant="deal" size="sm" onClick={save} disabled={dirtyCount === 0 || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Kaydet{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </Button>
          </>
        }
      />

      {/* Entegrasyon durumu */}
      {integrations && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <IntegrationCard
            icon={CreditCard}
            title="Sanal POS"
            value={integrations.payment.default.toUpperCase()}
            ok
            notes={[
              integrations.payment.test_mode ? 'TEST modunda' : 'CANLI modda',
              integrations.payment.force_3d ? '3D Secure zorunlu' : '3D Secure isteğe bağlı',
              integrations.payment.providers.some((p) => p.configured)
                ? `Kimlik bilgisi girili: ${integrations.payment.providers.filter((p) => p.configured).map((p) => p.label).join(', ')}`
                : 'Hiçbir POS için kimlik bilgisi girilmemiş',
            ]}
            action={
              <Button variant="outline" size="sm" disabled={posTesting} onClick={testPayment}>
                {posTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />}
                Bağlantıyı Test Et
              </Button>
            }
          />
          <IntegrationCard
            icon={Receipt}
            title="e-Fatura"
            value={integrations.einvoice.configured ? `BirFatura · ${integrations.einvoice.enabled ? 'otomatik' : 'elle'}` : 'Kurulmadı'}
            ok={integrations.einvoice.configured}
            notes={[
              integrations.einvoice.configured ? 'API bilgileri tanımlı' : 'API bilgileri eksik (Entegrasyonlar)',
              integrations.einvoice.enabled ? 'Teslimatta otomatik kesim açık' : "Sipariş detayından 'e-Fatura Kes'",
            ]}
          />
          <IntegrationCard
            icon={Truck}
            title="Kargo"
            value={integrations.shipping.default === 'yurtici' ? 'Yurtiçi Kargo' : integrations.shipping.default}
            ok={integrations.shipping.yurtici_enabled}
            notes={[integrations.shipping.yurtici_enabled ? 'Entegrasyon açık' : 'Entegrasyon kapalı']}
          />
          <IntegrationCard
            icon={MessageSquare}
            title="SMS"
            value={integrations.sms.enabled ? integrations.sms.provider.toUpperCase() : 'Kapalı'}
            ok={integrations.sms.enabled}
            notes={[
              integrations.sms.header ? `Başlık: ${integrations.sms.header}` : 'Başlık tanımsız',
              `Mail: ${integrations.mail.mailer}`,
            ]}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Grup listesi */}
        <aside className="space-y-1">
          {groupKeys.map((key) => {
            const g = GROUP_META[key];
            const Icon = g?.icon ?? SettingsIcon;
            const changed = Object.keys(draft).filter((d) => d.startsWith(`${key}.`)).length;

            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active === key ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{g?.label ?? key}</span>
                {changed > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 text-[10px] font-bold',
                    active === key ? 'bg-white/25' : 'bg-warning/20 text-warning',
                  )}>
                    {changed}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Alanlar */}
        <div className="min-w-0 rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <p className="font-bold">{meta?.label ?? active}</p>
            {meta?.hint && <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>}
          </div>

          <div className="divide-y divide-border">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Bu grupta ayar yok.</p>
            ) : (
              items.map((item) => {
                const value = valueOf(item);
                const changed = Object.prototype.hasOwnProperty.call(draft, path(item.key));

                return (
                  <div key={item.key} className={cn('flex flex-wrap items-start gap-3 p-4', changed && 'bg-warning/5')}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {item.label}
                        {item.is_public && (
                          <span title="Bu ayar vitrinde herkese görünür"><Eye className="size-3 text-muted-foreground" /></span>
                        )}
                        {changed && <Badge variant="warning" className="text-[10px]">değişti</Badge>}
                      </p>
                      <code className="text-[10px] text-muted-foreground">{active}.{item.key}</code>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>

                    <div className="w-full sm:w-72">
                      {item.type === 'boolean' ? (
                        <div className="flex h-9 items-center gap-2">
                          <Switch
                            checked={value === true || value === '1' || value === 1}
                            onCheckedChange={(checked) => set(item, checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {value === true || value === '1' || value === 1 ? 'Açık' : 'Kapalı'}
                          </span>
                        </div>
                      ) : item.type === 'text' ? (
                        <textarea
                          rows={3}
                          value={String(value ?? '')}
                          onChange={(e) => set(item, e.target.value)}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                                     focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <Input
                          type={item.is_encrypted ? 'password' : item.type === 'integer' ? 'number' : 'text'}
                          value={String(value ?? '')}
                          placeholder={item.is_encrypted ? 'Değiştirmek için yeni değeri yazın' : undefined}
                          onChange={(e) => set(item, e.target.value)}
                        />
                      )}

                      {item.is_encrypted && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Şifreli saklanır ve panelde asla düz metin gösterilmez.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {dirtyCount > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{dirtyCount} ayar değiştirildi, henüz kaydedilmedi.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDraft({})} disabled={saving}>Geri Al</Button>
                <Button variant="deal" size="sm" onClick={save} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} Kaydet
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test gönderimi */}
      <Dialog open={testOpen !== null} onOpenChange={(open) => { if (!open && !testing) { setTestOpen(null); setTestTarget(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{testOpen === 'mail' ? 'Test E-postası Gönder' : 'Test SMS Gönder'}</DialogTitle>
            <DialogDescription>
              {testOpen === 'mail'
                ? 'SMTP ayarlarının çalıştığını doğrular. Mesaj kuyruğa girmeden doğrudan gönderilir.'
                : 'NetGSM ayarlarının çalıştığını doğrular. Gönderim ücretlidir.'}
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {testOpen === 'mail' ? 'E-posta adresi' : 'Telefon numarası'} <span className="text-destructive">*</span>
            </label>
            <Input
              autoFocus
              type={testOpen === 'mail' ? 'email' : 'tel'}
              value={testTarget}
              onChange={(e) => setTestTarget(e.target.value)}
              placeholder={testOpen === 'mail' ? 'ornek@firma.com' : '05xxxxxxxxx'}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(null)} disabled={testing}>Vazgeç</Button>
            <Button variant="deal" onClick={runTest} disabled={testing || testTarget.trim().length < 5}>
              {testing && <Loader2 className="size-4 animate-spin" />} Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function IntegrationCard({
  icon: Icon, title, value, ok, notes, action,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  ok: boolean;
  notes: string[];
  /** Karta gömülen ekrana özel düğme (ör. "Bağlantıyı Test Et"). */
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn('flex size-8 items-center justify-center rounded-lg', ok ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          <p className="truncate text-sm font-bold">{value}</p>
        </div>
      </div>
      <ul className="mt-2 space-y-0.5">
        {notes.filter(Boolean).map((note) => (
          <li key={note} className="truncate text-[11px] text-muted-foreground" title={note}>· {note}</li>
        ))}
      </ul>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
