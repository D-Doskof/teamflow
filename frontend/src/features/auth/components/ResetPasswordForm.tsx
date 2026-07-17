'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useResetPassword } from '../hooks/useAuth';
import { getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

type FormValues = { password: string };

export function ResetPasswordForm() {
  const t = useT();
  const schema = useMemo(
    () =>
      z.object({
        password: z
          .string()
          .min(8, t.validation.passwordMin8)
          .regex(/[A-Z]/, t.validation.passwordUppercase)
          .regex(/[0-9]/, t.validation.passwordNumber),
      }),
    [t],
  );
  const token = useSearchParams().get('token');
  const resetPassword = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">{t.auth.resetPassword.invalidLink}</p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-primary hover:underline font-medium"
        >
          {t.auth.resetPassword.requestNew}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((data) => resetPassword.mutate({ token, password: data.password }))}
      className="space-y-4"
    >
      <Input
        label={t.auth.resetPassword.password}
        type="password"
        placeholder={t.auth.resetPassword.passwordPlaceholder}
        hint={t.validation.passwordHint}
        error={errors.password?.message}
        {...register('password')}
      />
      {resetPassword.error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(resetPassword.error) || t.auth.resetPassword.invalidLink}
        </p>
      )}
      <Button type="submit" className="w-full" isLoading={resetPassword.isPending}>
        {t.auth.resetPassword.submit}
      </Button>
    </form>
  );
}
