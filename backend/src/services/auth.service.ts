import { User } from '@prisma/client';
import crypto from 'crypto';
import { IUserRepository } from '../repositories/user.repository';
import { IRefreshTokenRepository } from '../repositories/refreshToken.repository';
import { IEmailVerificationRepository } from '../repositories/email-verification.repository';
import { IPasswordResetRepository } from '../repositories/password-reset.repository';
import { ITwoFactorCodeRepository } from '../repositories/two-factor-code.repository';
import { IPasswordHasher } from '../utils/hash.util';
import { ITokenService } from '../utils/jwt.util';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/error.util';
import { RegisterDto, LoginDto, UpdateProfileDto } from '../validators/auth.validator';
import { IEmailService } from './email.service';
import { env } from '../config/env';
import { resolveLocale } from '../utils/locale.util';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: Omit<User, 'password'>;
  tokens: AuthTokens;
}

interface TwoFactorRequired {
  requiresTwoFactor: true;
  twoFactorToken: string;
  email: string;
}

function generateTokenPayload(user: User) {
  return { userId: user.id, email: user.email, name: user.name };
}

function calculateRefreshExpiry(): Date {
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN.replace('d', ''), 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

function generateCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function stripPassword(user: User): Omit<User, 'password'> {
  const { password: _password, ...rest } = user;
  return rest;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

export interface IAuthService {
  register(dto: RegisterDto): Promise<AuthResult>;
  login(dto: LoginDto): Promise<AuthResult | TwoFactorRequired>;
  twoFactorLogin(twoFactorToken: string, code: string): Promise<AuthResult>;
  setTwoFactor(userId: string, enabled: boolean, code?: string): Promise<Omit<User, 'password'>>;
  requestDisableTwoFactor(userId: string): Promise<void>;
  verifyEmail(userId: string, code: string): Promise<Omit<User, 'password'>>;
  resendVerification(userId: string): Promise<void>;
  forgotPassword(email: string, origin: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  refresh(token: string): Promise<AuthTokens>;
  logout(token: string): Promise<void>;
  getProfile(userId: string): ReturnType<IUserRepository['findPublic']>;
  updateProfile(userId: string, data: UpdateProfileDto): Promise<Omit<User, 'password'>>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  updateAvatar(userId: string, avatar: string): Promise<Omit<User, 'password'>>;
}

// Deps-object constructor: too many dependencies for a positional list without risking
// argument-order mistakes; named fields can't be misordered.
export interface AuthServiceDeps {
  userRepository: IUserRepository;
  refreshTokenRepository: IRefreshTokenRepository;
  emailVerificationRepository: IEmailVerificationRepository;
  passwordResetRepository: IPasswordResetRepository;
  twoFactorCodeRepository: ITwoFactorCodeRepository;
  emailService: IEmailService;
  tokenService: ITokenService;
  passwordHasher: IPasswordHasher;
}

export class AuthService implements IAuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const {
      userRepository,
      refreshTokenRepository,
      emailVerificationRepository,
      emailService,
      tokenService,
      passwordHasher,
    } = this.deps;

    const existing = await userRepository.findByEmail(dto.email);
    if (existing)
      throw new ConflictError('Email is already registered', 'EMAIL_ALREADY_REGISTERED');

    const hashedPassword = await passwordHasher.hash(dto.password);
    // dto.locale (sent by the frontend at signup) is captured now so the verification
    // email below goes out in the right language instead of defaulting to 'en'.
    const user = await userRepository.create({
      email: dto.email,
      name: dto.name,
      password: hashedPassword,
      ...(dto.locale ? { locale: dto.locale } : {}),
    });

    const payload = generateTokenPayload(user);
    const accessToken = tokenService.signAccessToken(payload);
    const refreshToken = tokenService.signRefreshToken(payload);
    await refreshTokenRepository.create(user.id, refreshToken, calculateRefreshExpiry());

    // Send verification code (non-blocking)
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await emailVerificationRepository.create(user.id, code, expiresAt);
    emailService
      .sendVerificationCode(user.email, user.name, code, resolveLocale(user.locale))
      .catch((err) => console.error('[Email] Failed to send verification code:', err));

    return { user: stripPassword(user), tokens: { accessToken, refreshToken } };
  }

  async login(dto: LoginDto): Promise<AuthResult | TwoFactorRequired> {
    const {
      userRepository,
      refreshTokenRepository,
      twoFactorCodeRepository,
      emailService,
      tokenService,
      passwordHasher,
    } = this.deps;

    const user = await userRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');

    const isPasswordValid = await passwordHasher.compare(dto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');

    if (user.twoFactorEnabled) {
      await twoFactorCodeRepository.deleteByUser(user.id);
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await twoFactorCodeRepository.create(user.id, code, expiresAt);
      emailService
        .sendTwoFactorCode(user.email, user.name, code, resolveLocale(user.locale))
        .catch((err) => console.error('[Email] Failed to send two-factor code:', err));

      return {
        requiresTwoFactor: true,
        twoFactorToken: tokenService.signTwoFactorToken(user.id),
        email: maskEmail(user.email),
      };
    }

    const payload = generateTokenPayload(user);
    const accessToken = tokenService.signAccessToken(payload);
    const refreshToken = tokenService.signRefreshToken(payload);
    await refreshTokenRepository.create(user.id, refreshToken, calculateRefreshExpiry());

    return { user: stripPassword(user), tokens: { accessToken, refreshToken } };
  }

  async twoFactorLogin(twoFactorToken: string, code: string): Promise<AuthResult> {
    const { userRepository, refreshTokenRepository, twoFactorCodeRepository, tokenService } =
      this.deps;

    let userId: string;
    try {
      userId = tokenService.verifyTwoFactorToken(twoFactorToken);
    } catch {
      throw new UnauthorizedError(
        'Invalid or expired two-factor session',
        'INVALID_TWO_FACTOR_TOKEN',
      );
    }

    await this.verifyTwoFactorCode(userId, code);

    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User', 'USER_NOT_FOUND');

    await twoFactorCodeRepository.deleteByUser(userId);

    const payload = generateTokenPayload(user);
    const accessToken = tokenService.signAccessToken(payload);
    const refreshToken = tokenService.signRefreshToken(payload);
    await refreshTokenRepository.create(user.id, refreshToken, calculateRefreshExpiry());

    return { user: stripPassword(user), tokens: { accessToken, refreshToken } };
  }

  // Shared by twoFactorLogin and setTwoFactor's disable flow — same "is this code
  // valid right now" check; only what happens after differs per caller.
  private async verifyTwoFactorCode(userId: string, code: string): Promise<void> {
    const record = await this.deps.twoFactorCodeRepository.findValid(userId, code);
    if (!record) throw new BadRequestError('Invalid or expired code', 'INVALID_VERIFICATION_CODE');
  }

  async setTwoFactor(userId: string, enabled: boolean, code?: string) {
    const { userRepository, twoFactorCodeRepository } = this.deps;

    // Enabling 2FA doesn't reduce account security, so it stays an instant toggle.
    // Disabling it does, so it requires the same email-code verification as login.
    if (!enabled) {
      if (!code) {
        throw new ValidationError(
          'Verification code is required to disable two-factor authentication',
          undefined,
          'VERIFICATION_CODE_REQUIRED',
        );
      }
      await this.verifyTwoFactorCode(userId, code);
      await twoFactorCodeRepository.deleteByUser(userId);
    }

    const user = await userRepository.update(userId, { twoFactorEnabled: enabled });
    return stripPassword(user);
  }

  async requestDisableTwoFactor(userId: string): Promise<void> {
    const { userRepository, twoFactorCodeRepository, emailService } = this.deps;

    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User', 'USER_NOT_FOUND');
    if (!user.twoFactorEnabled) {
      throw new BadRequestError(
        'Two-factor authentication is not enabled',
        'TWO_FACTOR_NOT_ENABLED',
      );
    }

    await twoFactorCodeRepository.deleteByUser(user.id);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await twoFactorCodeRepository.create(user.id, code, expiresAt);
    emailService
      .sendTwoFactorCode(user.email, user.name, code, resolveLocale(user.locale))
      .catch((err) => console.error('[Email] Failed to send two-factor code:', err));
  }

  async verifyEmail(userId: string, code: string) {
    const { userRepository, emailVerificationRepository } = this.deps;

    const record = await emailVerificationRepository.findValid(userId, code);
    if (!record) throw new BadRequestError('Invalid or expired code', 'INVALID_VERIFICATION_CODE');

    const user = await userRepository.update(userId, { isEmailVerified: true });
    await emailVerificationRepository.deleteByUser(userId);
    return stripPassword(user);
  }

  async resendVerification(userId: string): Promise<void> {
    const { userRepository, emailVerificationRepository, emailService } = this.deps;

    const user = await userRepository.findPublic(userId);
    if (!user) throw new NotFoundError('User', 'USER_NOT_FOUND');
    if (user.isEmailVerified)
      throw new BadRequestError('Email already verified', 'EMAIL_ALREADY_VERIFIED');

    await emailVerificationRepository.deleteByUser(userId);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await emailVerificationRepository.create(userId, code, expiresAt);
    await emailService.sendVerificationCode(
      user.email,
      user.name,
      code,
      resolveLocale(user.locale),
    );
  }

  async forgotPassword(email: string, origin: string): Promise<void> {
    const { userRepository, passwordResetRepository, emailService } = this.deps;

    const user = await userRepository.findByEmail(email);
    if (!user) return; // don't reveal whether the account exists

    await passwordResetRepository.deleteByUser(user.id);
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await passwordResetRepository.create(user.id, token, expiresAt);

    const link = `${origin}/reset-password?token=${token}`;
    // Locale comes from the already-fetched `user` row (no extra query/await), so this
    // doesn't reopen the account-enumeration gap the early `return` above guards against.
    emailService
      .sendPasswordResetLink(user.email, user.name, link, resolveLocale(user.locale))
      .catch((err) => console.error('[Email] Failed to send password reset link:', err));
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const { passwordResetRepository, userRepository, refreshTokenRepository, passwordHasher } =
      this.deps;

    const record = await passwordResetRepository.findValid(token);
    if (!record) throw new BadRequestError('Invalid or expired link', 'INVALID_RESET_LINK');

    const hashedPassword = await passwordHasher.hash(password);
    await userRepository.update(record.userId, { password: hashedPassword });
    await passwordResetRepository.deleteByUser(record.userId);
    // Force re-login everywhere — a leaked/reset password shouldn't leave old sessions alive.
    await refreshTokenRepository.deleteAllForUser(record.userId);
  }

  async refresh(token: string): Promise<AuthTokens> {
    const { refreshTokenRepository, tokenService } = this.deps;

    const storedToken = await refreshTokenRepository.findByToken(token);
    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    tokenService.verifyRefreshToken(token);

    await refreshTokenRepository.deleteByToken(token);

    const payload = generateTokenPayload(storedToken.user);
    const accessToken = tokenService.signAccessToken(payload);
    const refreshToken = tokenService.signRefreshToken(payload);

    await refreshTokenRepository.create(storedToken.userId, refreshToken, calculateRefreshExpiry());

    return { accessToken, refreshToken };
  }

  async logout(token: string): Promise<void> {
    await this.deps.refreshTokenRepository.deleteByToken(token).catch(() => null);
  }

  async getProfile(userId: string) {
    const user = await this.deps.userRepository.findPublic(userId);
    if (!user) throw new NotFoundError('User', 'USER_NOT_FOUND');
    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await this.deps.userRepository.update(userId, data);
    return stripPassword(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const { userRepository, refreshTokenRepository, passwordHasher } = this.deps;

    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User', 'USER_NOT_FOUND');

    const isCurrentValid = await passwordHasher.compare(currentPassword, user.password);
    if (!isCurrentValid)
      throw new UnauthorizedError('Current password is incorrect', 'INCORRECT_CURRENT_PASSWORD');

    const hashedPassword = await passwordHasher.hash(newPassword);
    await userRepository.update(userId, { password: hashedPassword });
    // Same policy as reset-password: invalidate refresh tokens everywhere. The current
    // access token stays valid until it expires.
    await refreshTokenRepository.deleteAllForUser(userId);
  }

  async updateAvatar(userId: string, avatar: string) {
    const user = await this.deps.userRepository.update(userId, { avatar });
    return stripPassword(user);
  }
}
