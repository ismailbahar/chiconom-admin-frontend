import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/panel/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminApi } from '@/lib/api';
import { errorMessage, fieldErrors } from '@/lib/apiError';

/**
 * Panel şifre değiştirme. Şifre değişince bu oturum HARİÇ diğer tüm
 * oturumlar sunucu tarafında kapatılır.
 */
export default function PanelPassword() {
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (form.password !== form.password_confirmation) {
      setErrors({ password_confirmation: 'Şifreler eşleşmiyor.' });
      return;
    }

    setSaving(true);
    try {
      await adminApi.post('/password/change', form);
      toast.success('Şifreniz güncellendi. Diğer oturumlarınız kapatıldı.');
      setForm({ current_password: '', password: '', password_confirmation: '' });
    } catch (error) {
      setErrors(fieldErrors(error));
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <PageHeader title="Şifre Değiştir" description="Güvenliğiniz için düzenli olarak şifrenizi yenileyin." icon={KeyRound} />

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        {[
          { key: 'current_password', label: 'Mevcut Şifre' },
          { key: 'password', label: 'Yeni Şifre', hint: 'En az 8 karakter' },
          { key: 'password_confirmation', label: 'Yeni Şifre (Tekrar)' },
        ].map((field) => (
          <div key={field.key}>
            <label className="mb-1.5 block text-sm font-medium">{field.label}</label>
            <Input
              type="password"
              value={form[field.key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
              autoComplete={field.key === 'current_password' ? 'current-password' : 'new-password'}
            />
            {field.hint && <p className="mt-1 text-[11px] text-muted-foreground">{field.hint}</p>}
            {errors[field.key] && <p className="mt-1 text-xs text-destructive">{errors[field.key]}</p>}
          </div>
        ))}

        <Button type="submit" variant="deal" className="w-full" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Şifreyi Güncelle
        </Button>
      </form>
    </div>
  );
}
