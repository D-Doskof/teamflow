import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../utils/locale.util';

const localeSchema = z.enum(SUPPORTED_LOCALES);

export const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  // Captured at signup so the verification email goes out in the right language
  // instead of defaulting to 'en'.
  locale: localeSchema.optional(),
});

// Was previously unvalidated — req.body went straight to userRepository.update(id, data),
// so any extra key would have hit Prisma's User update untouched. This schema closes that.
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  bio: z.string().max(500).trim().optional(),
  locale: localeSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain number'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain number'),
});

// ~2MB decoded image, base64-inflated (base64 is ~4/3 the size of the raw bytes)
const AVATAR_MAX_BASE64_LENGTH = 2_800_000;

export const updateAvatarSchema = z.object({
  avatar: z
    .string()
    .min(1)
    .max(AVATAR_MAX_BASE64_LENGTH, 'Image is too large')
    .regex(
      /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/,
      'Avatar must be a PNG, JPEG, GIF or WEBP image',
    ),
});

export const twoFactorSchema = z.object({
  twoFactorToken: z.string().min(1),
  code: z.string().length(6),
});

export const setTwoFactorSchema = z
  .object({
    enabled: z.boolean(),
    // Only required when turning 2FA off — enabling it needs no proof of anything.
    code: z.string().length(6).optional(),
  })
  .refine((data) => data.enabled || !!data.code, {
    message: 'Verification code is required to disable two-factor authentication',
    path: ['code'],
  });

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
