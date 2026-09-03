import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import PanelLogin from '@/pages/PanelLogin';

const PanelRoutes = lazy(() => import('@/pages/admin/AdminRoutes'));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-7 animate-spin text-brand" />
    </div>
  );
}

/**
 * Sayfa değişince yukarı kaydırır (SPA'de tarayıcı bunu kendi yapmaz).
 *
 * DİKKAT: efekt gövdesi BLOK olmalı. Kısa gövdeli ok fonksiyonu
 * (`() => window.scrollTo(0, 0)`) yazılırsa scrollTo'nun dönüş değeri
 * React'e "temizleme fonksiyonu" olarak verilir ve uygulama
 * "destroy is not a function" hatasıyla çöker.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * Yönetim paneli — kendi alan adının KÖKÜNDE yaşar.
 *
 * Vitrin ve diğer panel ayrı uygulamalardır (ayrı depo, ayrı derleme).
 * Bu yüzden burada `/admin` ön eki YOKTUR; rotalar doğrudan
 * kökten başlar.
 */
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/giris" element={<PanelLogin />} />
          <Route path="/*" element={<PanelRoutes />} />
        </Routes>
      </Suspense>
    </>
  );
}
