'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { useLogin, useTwoFactor } from '../hooks/useAuth';
import { getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

type FormValues = { email: string; password: string };

export function LoginForm() {
  const t = useT();
  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t.validation.invalidEmail),
        password: z.string().min(1, t.validation.passwordRequired),
      }),
    [t],
  );
  const login = useLogin();
  const twoFactor = useTwoFactor();

  const [twoFactorState, setTwoFactorState] = useState<{
    token: string;
    maskedEmail: string;
  } | null>(null);
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onLoginSubmit = (data: FormValues) => {
    login.mutate(data, {
      onSuccess: (result) => {
        if (result.requiresTwoFactor && result.twoFactorToken) {
          setTwoFactorState({ token: result.twoFactorToken, maskedEmail: result.email ?? '' });
          startCooldown();
        }
      },
    });
  };

  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    const { email, password } = getValues();
    setDigits(Array(6).fill(''));
    login.mutate(
      { email, password },
      {
        onSuccess: (result) => {
          if (result.requiresTwoFactor && result.twoFactorToken) {
            setTwoFactorState({ token: result.twoFactorToken, maskedEmail: result.email ?? '' });
            startCooldown();
          }
        },
      },
    );
  };

  const handleTwoFactorComplete = (code: string) => {
    if (!twoFactorState) return;
    twoFactor.mutate({ twoFactorToken: twoFactorState.token, code });
  };

  // ── 2FA step ────────────────────────────────────────────────────────────────
  if (twoFactorState) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setTwoFactorState(null);
            setDigits(Array(6).fill(''));
          }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t.common.back}
        </button>

        <div className="flex flex-col items-center text-center gap-3 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{t.settings.twoFactor.checkEmail}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t.settings.twoFactor.codeSentTo(twoFactorState.maskedEmail)}
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <OtpInput
            value={digits}
            onChange={setDigits}
            onComplete={handleTwoFactorComplete}
            disabled={twoFactor.isPending}
          />
        </div>

        {twoFactor.error && (
          <p className="text-sm text-destructive text-center">{getErrorMessage(twoFactor.error)}</p>
        )}

        <Button
          className="w-full"
          isLoading={twoFactor.isPending}
          disabled={digits.join('').length !== 6}
          onClick={() => handleTwoFactorComplete(digits.join(''))}
        >
          {t.common.confirm}
        </Button>

        <p className="text-sm text-center text-muted-foreground">
          {t.settings.twoFactor.didntGetCode}{' '}
          {resendCooldown > 0 ? (
            <span className="text-muted-foreground">
              {t.settings.twoFactor.resendIn(resendCooldown)}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={login.isPending}
              className="text-primary hover:underline font-medium disabled:opacity-50"
            >
              {t.settings.twoFactor.resend}
            </button>
          )}
        </p>
      </div>
    );
  }

  // ── Credentials step ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
      <Input
        label={t.auth.login.email}
        type="email"
        placeholder={t.auth.login.emailPlaceholder}
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label={t.auth.login.password}
        type="password"
        placeholder={t.auth.login.passwordPlaceholder}
        error={errors.password?.message}
        {...register('password')}
      />
      <div className="text-right -mt-2">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
          {t.auth.login.forgotLink}
        </Link>
      </div>
      {login.error && <p className="text-sm text-destructive">{getErrorMessage(login.error)}</p>}
      <Button type="submit" className="w-full" isLoading={login.isPending}>
        {t.auth.login.submit}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t.auth.login.noAccount}{' '}
        <Link href="/register" className="text-primary hover:underline font-medium">
          {t.auth.login.registerLink}
        </Link>
      </p>
    </form>
  );
}
