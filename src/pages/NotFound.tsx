import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  useEffect(() => {
    document.title = 'Sayfa bulunamadı — Chiconom';
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="bg-brand-gradient bg-clip-text text-7xl font-black text-transparent">404</p>
      <h1 className="mt-3 text-xl font-black">Aradığınız sayfa bulunamadı</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bağlantı taşınmış veya süresi dolmuş olabilir.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="deal" asChild>
          <Link to="/"><Home className="size-4" /> Anasayfa</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/urunler"><Search className="size-4" /> Ürünlere Göz At</Link>
        </Button>
      </div>
    </div>
  );
}
