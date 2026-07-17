'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useRegister } from '../hooks/useAuth';
import { getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

type FormValues = { name: string; email: string; password: string };

export function RegisterForm() {
  const t = useT();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t.validation.nameMin2),
        email: z.string().email(t.validation.invalidEmail),
        password: z
          .string()
          .min(8, t.validation.passwordMin8)
          .regex(/[A-Z]/, t.validation.passwordUppercase)
          .regex(/[0-9]/, t.validation.passwordNumber),
      }),
    [t],
  );
  const register_ = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit((data) => register_.mutate(data))} className="space-y-4">
      <Input
        label={t.auth.register.name}
        placeholder={t.auth.register.namePlaceholder}
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label={t.auth.register.email}
        type="email"
        placeholder={t.auth.register.emailPlaceholder}
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label={t.auth.register.password}
        type="password"
        placeholder={t.auth.register.passwordPlaceholder}
        hint={t.validation.passwordHint}
        error={errors.password?.message}
        {...register('password')}
      />
      {register_.error && (
        <p className="text-sm text-destructive">{getErrorMessage(register_.error)}</p>
      )}
      <Button type="submit" className="w-full" isLoading={register_.isPending}>
        {t.auth.register.submit}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t.auth.register.hasAccount}{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">
          {t.auth.register.loginLink}
        </Link>
      </p>
    </form>
  );
}
