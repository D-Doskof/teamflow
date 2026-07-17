'use client';

import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n/useT';

export default function NotFound() {
  const t = useT();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[440px] w-[440px] rounded-full opacity-25 blur-3xl"
        style={{ backgroundImage: 'var(--gradient-signature)' }}
      />
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20"
            style={{ backgroundImage: 'var(--gradient-signature)' }}
          >
            <Compass className="h-10 w-10 text-white" />
          </div>
        </div>

        <p
          className="text-6xl font-bold tracking-tight bg-clip-text text-transparent"
          style={{ backgroundImage: 'var(--gradient-signature)' }}
        >
          {t.notFound.code}
        </p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">{t.notFound.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.notFound.subtitle}</p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={isAuthenticated ? '/workspaces' : '/'}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4" />
            {isAuthenticated ? t.notFound.backDashboard : t.notFound.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
