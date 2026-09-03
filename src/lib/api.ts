import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * YÖNETİM PANELİ API İSTEMCİSİ.
 *
 * Vitrin ayrı bir uygulamadır; buradan yalnız `/admin/*` uçlarına gidilir.
 * Jeton tarayıcıda panele özel anahtarla saklanır; vitrin oturumuyla
 * karışmaz.
 */
export const adminApi = axios.create({
  baseURL: `${BASE}/api/v1/admin`,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'chc_admin_token';

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);

      // Zaten giriş sayfasındaysak döngüye girme
      if (window.location.pathname !== '/giris') {
        window.location.href = '/giris';
      }
    }

    return Promise.reject(error);
  },
);

/** Vitrinin adresi — panel içi bağlantı değil, dış bağlantıdır. */
export const STORE_URL = import.meta.env.VITE_STORE_URL ?? 'http://localhost:5180';

export default adminApi;
