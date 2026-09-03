import { create } from 'zustand';
import { adminApi } from '@/lib/api';

const TOKEN_KEY = 'chc_admin_token';
const USER_KEY = 'chc_admin_user';

export interface PanelUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  avatar: string | null;
  scope: 'admin';
  roles: string[];
  permissions: string[];
}

interface PanelAuthState {
  user: PanelUser | null;
  isLoggedIn: boolean;
  loading: boolean;

  login: (email: string, password: string) => Promise<PanelUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Yetki kontrolü — süper admin her zaman geçer. */
  can: (permission: string | string[]) => boolean;
  hasRole: (role: string) => boolean;
}

function readStored(): PanelUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PanelUser) : null;
  } catch {
    return null;
  }
}

/** Yönetim paneli oturumu. */
export const usePanelAuthStore = create<PanelAuthState>((set, get) => ({
  user: readStored(),
  isLoggedIn: Boolean(localStorage.getItem(TOKEN_KEY)),
  loading: false,

  login: async (email, password) => {
    set({ loading: true });

    try {
      const { data } = await adminApi.post('/login', { email, password });

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      set({ user: data.user, isLoggedIn: true });

      return data.user as PanelUser;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    try {
      await adminApi.post('/logout');
    } catch {
      // Jeton sunucuda zaten geçersizse de yerel oturumu kapat
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null, isLoggedIn: false });
  },

  refresh: async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    try {
      const { data } = await adminApi.get('/me');

      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      set({ user: data.user, isLoggedIn: true });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ user: null, isLoggedIn: false });
    }
  },

  can: (permission) => {
    const user = get().user;

    if (!user) return false;
    // Süper admin tüm yetkilere sahiptir
    if (user.roles?.includes('super-admin')) return true;

    const list = Array.isArray(permission) ? permission : [permission];

    return list.some((p) => user.permissions?.includes(p));
  },

  hasRole: (role) => Boolean(get().user?.roles?.includes(role)),
}));
