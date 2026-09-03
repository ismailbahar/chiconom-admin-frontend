import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, LayoutDashboard, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ÇÖKEN EKRAN PANELİ KİLİTLEMEZ.
 *
 * React'te çizim sırasında yakalanmayan tek bir hata TÜM ağacı söker: ekran
 * bembeyaz kalır, ne mesaj ne çıkış yolu olur. Panelde bu, çalışanın işini
 * ortasında bırakır ve "site kapandı" diye bildirilir — oysa bozuk olan tek
 * bir ekrandır.
 *
 * SINIF BİLEŞENİ ZORUNLUDUR — `getDerivedStateFromError` ve
 * `componentDidCatch` için kanca (hook) karşılığı yoktur.
 */
class Sinir extends Component<{ children: ReactNode }, { hata: Error | null }> {
  state = { hata: null as Error | null };

  static getDerivedStateFromError(hata: Error) {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    /** Yığın izi konsolda kalsın — kullanıcıya gösterilen metin teşhise yetmez. */
    console.error('Ekran çöktü:', hata, bilgi.componentStack);
  }

  render() {
    if (! this.state.hata) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-7 text-destructive" />
        </div>

        <h1 className="text-xl font-black">Bu ekran açılamadı</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Beklenmedik bir hata oluştu. Verilerinizde bir kayıp yok; diğer
          ekranlar çalışmaya devam ediyor.
        </p>

        {/* Ayrıntı yalnız geliştirme kipinde görünür */}
        {import.meta.env.DEV && (
          <pre className="mt-4 max-h-40 w-full overflow-auto rounded-lg bg-secondary/50 p-3 text-left text-[11px]">
            {this.state.hata.message}
          </pre>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button variant="deal" onClick={() => window.location.reload()}>
            <RotateCw className="size-4" /> Sayfayı yenile
          </Button>
          <Button variant="outline" asChild>
            <Link to="/"><LayoutDashboard className="size-4" /> Kontrol paneli</Link>
          </Button>
        </div>
      </div>
    );
  }
}

/**
 * Adres değişince sınır SIFIRLANIR.
 *
 * React hata sınırları kendiliğinden toparlanmaz: bir kez tetiklendiğinde,
 * kullanıcı menüden başka bir ekrana geçse bile hata görüntüsü ekranda
 * kalırdı. Yol adını `key` yapmak bileşeni her gezinmede yeniden kurar.
 */
export default function ErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return <Sinir key={pathname}>{children}</Sinir>;
}
