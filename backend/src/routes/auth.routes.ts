import { Router } from 'express';
import { authController } from '../container';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware';
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateAvatarSchema,
  twoFactorSchema,
  setTwoFactorSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authRateLimiter, validate(loginSchema), authController.login);
authRouter.post('/refresh', validate(refreshTokenSchema), authController.refresh);
authRouter.post('/logout', validate(refreshTokenSchema), authController.logout);
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

authRouter.get('/me', authenticate, authController.getProfile);
authRouter.patch('/me', authenticate, validate(updateProfileSchema), authController.updateProfile);
authRouter.patch(
  '/password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);
authRouter.post('/avatar', authenticate, validate(updateAvatarSchema), authController.updateAvatar);
authRouter.post(
  '/two-factor',
  authRateLimiter,
  validate(twoFactorSchema),
  authController.twoFactor,
);
authRouter.patch(
  '/two-factor',
  authenticate,
  validate(setTwoFactorSchema),
  authController.setTwoFactor,
);
authRouter.post(
  '/two-factor/request-disable',
  authenticate,
  authRateLimiter,
  authController.requestDisableTwoFactor,
);

authRouter.post('/verify-email', authenticate, authController.verifyEmail);
authRouter.post('/resend-verification', authenticate, authController.resendVerification);
