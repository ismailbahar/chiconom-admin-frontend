import { AxiosError } from 'axios';

/**
 * Backend hata zarfı:
 *   { message: string, errors?: { alan: [mesaj] } }
 *
 * Bu iki yardımcı, her yerde aynı biçimde okunmasını sağlar; bileşenler
 * axios hatasının iç yapısını bilmek zorunda kalmaz.
 */

interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

/** Kullanıcıya gösterilecek tek satırlık mesaj. */
export function errorMessage(error: unknown, fallback = 'Bir hata oluştu. Lütfen tekrar deneyin.'): string {
  const err = error as AxiosError<ApiErrorBody>;

  if (!err?.isAxiosError) return fallback;

  // Ağ hatası (sunucuya ulaşılamadı)
  if (!err.response) return 'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.';

  const body = err.response.data;

  // Doğrulama hatalarında ilk alanın ilk mesajı en anlamlısıdır
  const firstFieldError = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;

  return firstFieldError ?? body?.message ?? fallback;
}

/** Form alanlarına dağıtmak için alan → mesaj eşlemesi. */
export function fieldErrors(error: unknown): Record<string, string> {
  const err = error as AxiosError<ApiErrorBody>;
  const errors = err?.response?.data?.errors;

  if (!errors) return {};

  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, messages[0]]),
  );
}

export function statusCode(error: unknown): number | undefined {
  return (error as AxiosError)?.response?.status;
}
