import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Check, Copy, FileCheck2, Loader2, Plug, Receipt, RefreshCw, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import PageHeader, { StatCard } from '@/components/panel/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { formatDateTime, formatNumber } from '@/lib/utils';

interface Status {
  provider: string;
  auto_invoice: boolean;
  configured: boolean;
  base_url: string | null;
  queue: { pending: number; failed: number; done: number };
  invoices: { auto_total: number; pdf_pending: number; errors: number };
  company: { legal_name: string | null; tax_office: string | null; tax_no: string | null };
  pull: {
    token_set: boolean;
    site_url: string;
    endpoints: string[];
    statuses: Array<{ id: number; label: string }>;
  };
  failed_jobs: Array<{ id: number; source_id: number; order_number: string | null; error: string | null; attempts: number; processed_at: string | null }>;
}

/**
 * e-FATURA (BİRFATURA) DURUM EKRANI.
 *
 * Bağlantı, otomatik kesim, kuyruk ve PDF durumu; başarısız işleri yeniden
 * deneme; BirFatura "Özel Entegrasyon" için sitenin uç adresleri.
 */
export default function AdminEInvoice() {
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'e-Fatura — Chiconom Yönetim';
  }, []);

  const { data, isLoading } = useQuery<{ data: Status }>({
    queryKey: ['einvoice-status'],
    queryFn: async () => (await adminApi.get('/einvoice/status')).data,
    refetchInterval: 60_000,
  });

  const st = data?.data;

  const test = async () => {
    setTesting(true);
    try {
      const { data: res } = await adminApi.post('/test/einvoice');
      toast.success(res.message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const retry = async (id: number) => {
    setRetrying(id);
    try {
      const { data: res } = await adminApi.post(`/einvoice/queue/${id}/retry`);
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['einvoice-status'] });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRetrying(null);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success('Kopyalandı.')).catch(() => toast.error('Kopyalanamadı.'));
  };

  const companyMissing = st && (!st.company.tax_no || !st.company.legal_name);

  return (
    <div>
      <PageHeader
        title="e-Fatura (BirFatura)"
        description="Faturalar BirFatura üzerinden e-Fatura / e-Arşiv olarak kesilir, PDF'i müşteriye e-posta ile gider."
        icon={Receipt}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={!st?.configured || testing} onClick={test}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />} Bağlantıyı Test Et
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/ayarlar/entegrasyonlar">API Bilgileri</Link>
            </Button>
          </>
        }
      />

      {isLoading || !st ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-5">
          {!st.configured && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-semibold">BirFatura API bilgileri girilmemiş.</p>
                <p className="text-xs text-muted-foreground">
                  BirFatura → Ayarlar → API Bilgileri'nden X-Api-Key, X-Secret-Key ve X-Integration-Key alıp{' '}
                  <Link to="/ayarlar/entegrasyonlar" className="font-semibold text-brand hover:underline">Entegrasyonlar</Link> ekranına girin.
                  Bu sırada faturalar panelden PDF olarak yüklenmeye devam eder.
                </p>
              </div>
            </div>
          )}

          {companyMissing && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-semibold">Mağaza künyesi eksik.</p>
                <p className="text-xs text-muted-foreground">
                  Faturayı kesen tarafın ticari ünvanı ve vergi numarası <Link to="/ayarlar" className="font-semibold text-brand hover:underline">Ayarlar → Site Kimliği</Link> altında doldurulmalı.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Bağlantı" value={st.configured ? 'Kurulu' : 'Eksik'} hint={st.base_url ?? ''} icon={Plug} tone={st.configured ? 'success' : 'warning'} />
            <StatCard label="Otomatik kesim" value={st.auto_invoice ? 'Açık' : 'Kapalı'} hint={st.auto_invoice ? 'Teslimatta otomatik' : "Sipariş detayından 'e-Fatura Kes'"} icon={FileCheck2} tone={st.auto_invoice ? 'success' : 'default'} />
            <StatCard label="Kuyruk" value={formatNumber(st.queue.pending)} hint={`${st.queue.done} kesildi · ${st.queue.failed} başarısız`} icon={RefreshCw} tone={st.queue.failed > 0 ? 'danger' : 'default'} />
            <StatCard label="e-Fatura" value={formatNumber(st.invoices.auto_total)} hint={`${st.invoices.pdf_pending} PDF bekliyor · ${st.invoices.errors} hatalı`} icon={Receipt} tone="brand" />
            <StatCard label="Kesen firma" value={st.company.legal_name ?? '—'} hint={st.company.tax_no ? `VKN ${st.company.tax_no}${st.company.tax_office ? ` · ${st.company.tax_office}` : ''}` : 'Vergi no girilmemiş'} icon={Check} tone={companyMissing ? 'danger' : 'default'} />
          </div>

          {/* Başarısız işler */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-bold">Başarısız fatura işleri</p>
              <p className="text-xs text-muted-foreground">Deneme hakkını tüketen ya da kalıcı hata alan işler. Sorunu giderdikten sonra yeniden deneyin ya da sipariş detayından PDF yükleyin.</p>
            </div>
            {st.failed_jobs.length === 0 ? (
              <p className="p-5 text-center text-sm text-muted-foreground">Başarısız iş yok.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Sipariş</th>
                    <th className="px-4 py-2">Hata</th>
                    <th className="px-4 py-2">Deneme</th>
                    <th className="px-4 py-2">Tarih</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {st.failed_jobs.map((j) => (
                    <tr key={j.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        {j.order_number ? <Link to={`/siparisler/${j.order_number}`} className="font-mono text-xs font-bold hover:text-brand hover:underline">{j.order_number}</Link> : `#${j.source_id}`}
                      </td>
                      <td className="max-w-md px-4 py-2 text-xs text-destructive">{j.error}</td>
                      <td className="px-4 py-2 text-xs">{j.attempts}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{j.processed_at ? formatDateTime(j.processed_at) : '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="outline" size="sm" disabled={retrying === j.id} onClick={() => retry(j.id)}>
                          {retrying === j.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Yeniden dene
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Özel entegrasyon */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">BirFatura "Özel Entegrasyon" (isteğe bağlı)</p>
                <p className="text-xs text-muted-foreground">
                  İkinci yol: BirFatura panelinde "Özel Entegrasyon" mağazası açılır, site adresi ve GUID token yazılır; BirFatura siparişleri buradan çeker,
                  kendi ekranında faturalar ve PDF bağlantısını siparişe geri yazar.
                </p>
              </div>
              {st.pull.token_set
                ? <Badge variant="success" className="gap-1"><Check className="size-3" /> token tanımlı</Badge>
                : <Badge variant="secondary">token girilmemiş</Badge>}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">BirFatura'ya yazılacak site adresi</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate text-xs">{st.pull.site_url}</code>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => copy(st.pull.site_url)}><Copy className="size-3.5" /></Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Uçlar: {st.pull.endpoints.map((e) => e.replace(st.pull.site_url, '')).join(', ')}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sipariş durumu kimlikleri</p>
                <div className="flex flex-wrap gap-1">
                  {st.pull.statuses.map((s) => <Badge key={s.id} variant="soft">{s.id} · {s.label}</Badge>)}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">BirFatura'da faturalanacak durum olarak genellikle 1 (Ödendi) ya da 3 (Kargoda) seçilir.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
