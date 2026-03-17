import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatar: string | null;
};

type AuthStore = {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  isAdmin: () => boolean;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,

      setUser: (user) => set({ user }),
      setToken: (accessToken) => set({ accessToken }),

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await fetch('/api/auth?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
          });

          const data = await res.json();

          if (data.success) {
            set({ user: data.data.user, accessToken: data.data.accessToken });
            return { success: true };
          } else {
            return { success: false, error: data.error || 'Error al iniciar sesión' };
          }
        } catch {
          return { success: false, error: 'Error de conexión' };
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (userData) => {
        set({ isLoading: true });
        try {
          const res = await fetch('/api/auth?action=register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
            credentials: 'include',
          });

          const data = await res.json();

          if (data.success) {
            set({ user: data.data.user, accessToken: data.data.accessToken });
            return { success: true };
          } else {
            return { success: false, error: data.error || 'Error al registrarse' };
          }
        } catch {
          return { success: false, error: 'Error de conexión' };
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        await fetch('/api/auth?action=logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${get().accessToken}`,
          },
        });
        set({ user: null, accessToken: null });
      },

      refreshToken: async () => {
        try {
          const res = await fetch('/api/auth?action=refresh', {
            method: 'POST',
            credentials: 'include',
          });
          const data = await res.json();
          if (data.success) {
            set({ accessToken: data.data.accessToken });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
      },
    }),
    {
      name: 'divinittys-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);
