'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/features/auth/api/auth.api';

export type Locale = 'en' | 'ru' | 'pl';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  _hydrated: boolean;
  _setHydrated: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      _hydrated: false,
      setLocale: (locale) => {
        set({ locale });
        // Persist server-side so transactional emails (verification/2FA/reset/invitation) go
        // out in this language later. Reads localStorage directly (mirrors lib/axios.ts)
        // rather than pulling in useAuthStore; silently ignored while logged out or on failure.
        if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
          authApi.updateLocale(locale).catch(() => {});
        }
      },
      _setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: 'teamflow-locale',
      skipHydration: true,
    },
  ),
);
