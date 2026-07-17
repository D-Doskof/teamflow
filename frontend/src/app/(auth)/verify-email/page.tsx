'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { useVerifyEmail, useResendVerification } from '@/features/auth/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
import { CheckCircle2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const t = useT();
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(0);
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.isEmailVerified) router.replace('/workspaces');
  }, [user, router]);

  const startCooldown = () => {
    setCooldown(60);
    const id = setInterval(
      () =>
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(id);
            return 0;
          }
          return c - 1;
        }),
      1000,
    );
  };

  const handleComplete = (code: string) => verify.mutate(code);

  const handleResend = () => {
    if (cooldown > 0) return;
    setDigits(Array(6).fill(''));
    resend.mutate(undefined, { onSuccess: startCooldown });
  };

  if (!user || user.isEmailVerified) return null;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-background px-4 py-8">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="absolute top-[-10%] right-[-5%] w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ backgroundImage: 'var(--gradient-signature)' }}
      />
      <div
        aria-hidden
        className="absolute bottom-[-5%] left-[-5%] w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ backgroundImage: 'var(--gradient-signature)' }}
      />

      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Card */}
        <div className="bg-card/80 backdrop-blur-xl rounded-app shadow-2xl shadow-black/5 border border-border p-8 sm:p-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20"
                style={{ backgroundImage: 'var(--gradient-signature)' }}
              >
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {t.auth.verifyEmail.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t.auth.verifyEmail.sentCodeTo}{' '}
              <span className="font-semibold text-foreground break-all">{user.email}</span>
            </p>
          </div>

          {/* OTP */}
          <div className="flex justify-center mb-6">
            <OtpInput
              value={digits}
              onChange={setDigits}
              onComplete={handleComplete}
              disabled={verify.isPending}
            />
          </div>

          {/* Error */}
          {verify.error && (
            <p className="text-sm text-destructive text-center mb-4 flex items-center justify-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
              {getErrorMessage(verify.error)}
            </p>
          )}

          {/* Submit */}
          <Button
            className="w-full h-11 text-base font-semibold"
            isLoading={verify.isPending}
            disabled={digits.join('').length !== 6 || verify.isPending}
            onClick={() => handleComplete(digits.join(''))}
          >
            {verify.isPending ? t.auth.verifyEmail.verifying : t.auth.verifyEmail.submit}
          </Button>

          {/* Resend */}
          <div className="mt-5 text-center">
            {resend.isSuccess && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-green-600 dark:text-green-400 mb-2">
                <CheckCircle2 className="h-4 w-4" /> {t.auth.verifyEmail.resentSuccess}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t.settings.twoFactor.didntGetCode}{' '}
              {cooldown > 0 ? (
                <span className="text-muted-foreground tabular-nums">
                  {t.settings.twoFactor.resendIn(cooldown)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resend.isPending}
                  className="font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {resend.isPending ? t.auth.verifyEmail.resending : t.settings.twoFactor.resend}
                </button>
              )}
            </p>
          </div>

          {/* Divider hint */}
          <p className="mt-6 text-xs text-center text-muted-foreground">
            {t.auth.verifyEmail.spamHint}
          </p>
        </div>

        <p className="text-center mt-4 text-xs text-muted-foreground">
          {t.auth.verifyEmail.footer}
        </p>
      </div>
    </div>
  );
}
