'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useForgotPassword } from '../hooks/useAuth';
import { getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

type FormValues = { email: string };

export function ForgotPasswordForm() {
  const t = useT();
  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t.validation.invalidEmail),
      }),
    [t],
  );
  const forgotPassword = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  if (forgotPassword.isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <p className="text-sm text-muted-foreground">{t.auth.forgotPassword.sent}</p>
        <Link
          href="/login"
          className="inline-block text-sm text-primary hover:underline font-medium"
        >
          {t.auth.forgotPassword.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((data) => forgotPassword.mutate(data.email))}
      className="space-y-4"
    >
      <Input
        label={t.auth.forgotPassword.email}
        type="email"
        placeholder={t.auth.forgotPassword.emailPlaceholder}
        error={errors.email?.message}
        {...register('email')}
      />
      {forgotPassword.error && (
        <p className="text-sm text-destructive">{getErrorMessage(forgotPassword.error)}</p>
      )}
      <Button type="submit" className="w-full" isLoading={forgotPassword.isPending}>
        {t.auth.forgotPassword.submit}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline font-medium">
          {t.auth.forgotPassword.backToLogin}
        </Link>
      </p>
    </form>
  );
}
