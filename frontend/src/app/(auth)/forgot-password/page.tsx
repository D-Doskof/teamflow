'use client';

import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useT } from '@/lib/i18n/useT';

export default function ForgotPasswordPage() {
  const t = useT();

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
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t.auth.forgotPassword.title}</h1>
          <p className="mt-2 text-muted-foreground">{t.auth.forgotPassword.subtitle}</p>
        </div>
        <div className="card p-6 sm:p-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
