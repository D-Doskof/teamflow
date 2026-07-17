'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '@/store/auth.store';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      if (data.requiresTwoFactor) return; // handled by LoginForm
      // setAuth() already persists tokens to localStorage internally.
      setAuth(data.user!, data.tokens!);
      if (!data.user!.isEmailVerified) {
        router.push('/verify-email');
      } else {
        router.push('/workspaces');
      }
    },
  });
}

export function useTwoFactor() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.twoFactor,
    onSuccess: (data) => {
      // setAuth() already persists tokens to localStorage internally.
      setAuth(data.user, data.tokens);
      router.push('/workspaces');
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      // setAuth() already persists tokens to localStorage internally.
      setAuth(data.user, data.tokens);
      if (!data.user.isEmailVerified) {
        router.push('/verify-email');
      } else {
        router.push('/workspaces');
      }
    },
  });
}

export function useLogout() {
  const { refreshToken, clearAuth } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(refreshToken ?? ''),
    onSettled: () => {
      clearAuth();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      queryClient.clear();
      router.push('/login');
    },
  });
}

export function useVerifyEmail() {
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  return useMutation({
    mutationFn: (code: string) => authApi.verifyEmail(code),
    onSuccess: (data) => {
      setUser(data.user);
      router.push('/workspaces');
    },
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => router.push('/login'),
  });
}

export function useSetTwoFactor() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: authApi.setTwoFactor,
    onSuccess: (user) => setUser(user),
  });
}

export function useRequestDisableTwoFactor() {
  return useMutation({ mutationFn: authApi.requestDisableTwoFactor });
}
