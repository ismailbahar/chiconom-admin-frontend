import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STORE_URL } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/apiError';
import { usePanelAuthStore } from '@/stores/panelAuthStore';

/**
 * YÖNETİM PANELİ GİRİŞİ.
 *
 * Vitrin ayrı bir uygulamadır; ona giden bağlantı router bağlantısı değil,
 * TAM ADRESTİR (VITE_STORE_URL).
 */
export default function PanelLogin() {
  const navigate = useNavigate();
  const { login, loading, isLoggedIn } = usePanelAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = 'Chiconom Yönetim — Giriş';
  }, []);

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true });
  }, [isLoggedIn, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const loggedIn = await login(email, password);
      toast.success(`Hoş geldiniz, ${loggedIn.name}`);
      navigate('/', { replace: true });
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Chiconom" className="mx-auto h-12 w-auto" />
          <h1 className="mt-4 text-xl font-black tracking-tight">Yönetim Paneli</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chiconom mağaza yönetimine giriş yapın.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium">E-posta</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Şifre</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>

          <Button type="submit" variant="deal" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Giriş Yap
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <a href={STORE_URL} className="hover:text-brand hover:underline">← Mağazaya dön</a>
        </p>
      </div>
    </div>
  );
}
