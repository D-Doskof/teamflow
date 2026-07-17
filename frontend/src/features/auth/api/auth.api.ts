import { api } from '@/lib/axios';
import { ApiResponse, User } from '@/types';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export interface LoginResult {
  user?: User;
  tokens?: AuthTokens;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
  email?: string;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<ApiResponse<AuthResult>>('/auth/register', data).then((r) => r.data.data!),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<LoginResult>>('/auth/login', data).then((r) => r.data.data!),

  twoFactor: (data: { twoFactorToken: string; code: string }) =>
    api.post<ApiResponse<AuthResult>>('/auth/two-factor', data).then((r) => r.data.data!),

  setTwoFactor: (data: { enabled: boolean; code?: string }) =>
    api.patch<ApiResponse<User>>('/auth/two-factor', data).then((r) => r.data.data!),

  requestDisableTwoFactor: () => api.post('/auth/two-factor/request-disable'),

  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),

  getProfile: () => api.get<ApiResponse<User>>('/auth/me').then((r) => r.data.data!),

  updateProfile: (data: { name?: string; bio?: string }) =>
    api.patch<ApiResponse<User>>('/auth/me', data).then((r) => r.data.data!),

  // Fire-and-forget from locale.store.ts on language switch — persists it server-side so
  // transactional emails (verification/2FA/reset/invitation) go out in the right language
  // even outside of a request this user makes (forgot-password, invitations sent to them).
  updateLocale: (locale: 'en' | 'ru' | 'pl') =>
    api.patch<ApiResponse<User>>('/auth/me', { locale }),

  verifyEmail: (code: string) =>
    api.post<ApiResponse<{ user: User }>>('/auth/verify-email', { code }).then((r) => r.data.data!),

  resendVerification: () => api.post('/auth/resend-verification'),

  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data),
};
