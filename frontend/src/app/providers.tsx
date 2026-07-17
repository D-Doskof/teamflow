'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useLocaleStore } from '@/store/locale.store';
import { useThemeStore } from '@/store/theme.store';
import { useBoardLayoutStore } from '@/store/boardLayout.store';

function LocaleInit() {
  const { _hydrated, _setHydrated } = useLocaleStore();
  useEffect(() => {
    if (!_hydrated) {
      useLocaleStore.persist.rehydrate();
      _setHydrated();
    }
  }, [_hydrated, _setHydrated]);
  return null;
}

function ThemeInit() {
  useEffect(() => {
    useThemeStore.persist.rehydrate();
  }, []);
  return null;
}

function BoardLayoutInit() {
  useEffect(() => {
    useBoardLayoutStore.persist.rehydrate();
  }, []);
  return null;
}

// Registers the no-op service worker (public/sw.js) so the browser considers the
// app installable (Chrome/Android's "Add to Home Screen" prompt requires one).
function ServiceWorkerInit() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleInit />
      <ThemeInit />
      <BoardLayoutInit />
      <ServiceWorkerInit />
      {children}
    </QueryClientProvider>
  );
}
