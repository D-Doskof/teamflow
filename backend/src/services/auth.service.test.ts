import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { IUserRepository } from '../repositories/user.repository';
import { IRefreshTokenRepository } from '../repositories/refreshToken.repository';
import { IEmailVerificationRepository } from '../repositories/email-verification.repository';
import { IPasswordResetRepository } from '../repositories/password-reset.repository';
import { ITwoFactorCodeRepository } from '../repositories/two-factor-code.repository';
import { IEmailService } from './email.service';
import { ITokenService } from '../utils/jwt.util';
import { IPasswordHasher } from '../utils/hash.util';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user_1',
    email: 'alice@example.com',
    name: 'Alice',
    password: 'hashed-password',
    avatar: null,
    bio: null,
    isEmailVerified: false,
    twoFactorEnabled: false,
    locale: 'en',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

let userRepository: MockProxy<IUserRepository>;
let refreshTokenRepository: MockProxy<IRefreshTokenRepository>;
let emailVerificationRepository: MockProxy<IEmailVerificationRepository>;
let passwordResetRepository: MockProxy<IPasswordResetRepository>;
let twoFactorCodeRepository: MockProxy<ITwoFactorCodeRepository>;
let emailService: MockProxy<IEmailService>;
let tokenService: MockProxy<ITokenService>;
let passwordHasher: MockProxy<IPasswordHasher>;
let authService: AuthService;

// Shared factory: auth.service touches 8 collaborators, so building this once here (rather
// than repeating 8 mock<T>() calls per test) keeps every test focused on its own scenario.
beforeEach(() => {
  userRepository = mock<IUserRepository>();
  refreshTokenRepository = mock<IRefreshTokenRepository>();
  emailVerificationRepository = mock<IEmailVerificationRepository>();
  passwordResetRepository = mock<IPasswordResetRepository>();
  twoFactorCodeRepository = mock<ITwoFactorCodeRepository>();
  emailService = mock<IEmailService>();
  tokenService = mock<ITokenService>();
  passwordHasher = mock<IPasswordHasher>();

  authService = new AuthService({
    userRepository,
    refreshTokenRepository,
    emailVerificationRepository,
    passwordResetRepository,
    twoFactorCodeRepository,
    emailService,
    tokenService,
    passwordHasher,
  });

  tokenService.signAccessToken.mockReturnValue('access-token');
  tokenService.signRefreshToken.mockReturnValue('refresh-token');
  tokenService.signTwoFactorToken.mockReturnValue('two-factor-token');
  refreshTokenRepository.create.mockResolvedValue({} as never);
});

describe('authService.register', () => {
  it('rejects a duplicate email with EMAIL_ALREADY_REGISTERED', async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser());

    await expect(
      authService.register({ email: 'alice@example.com', password: 'Password123', name: 'Alice' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_ALREADY_REGISTERED' });

    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('creates the user, issues tokens, and sends a verification code — never leaks the password hash', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed-password');
    const created = makeUser();
    userRepository.create.mockResolvedValue(created);
    emailVerificationRepository.create.mockResolvedValue({} as never);
    emailService.sendVerificationCode.mockResolvedValue(undefined);

    const result = await authService.register({
      email: 'alice@example.com',
      password: 'Password123',
      name: 'Alice',
    });

    expect(result.tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(result.user).not.toHaveProperty('password');
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      'user_1',
      'refresh-token',
      expect.any(Date),
    );
    expect(emailVerificationRepository.create).toHaveBeenCalledWith(
      'user_1',
      expect.any(String),
      expect.any(Date),
    );
    expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'en',
    );
  });

  it('creates the user with the requested locale and sends the verification code in that locale', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed-password');
    userRepository.create.mockResolvedValue(makeUser({ locale: 'ru' }));
    emailVerificationRepository.create.mockResolvedValue({} as never);
    emailService.sendVerificationCode.mockResolvedValue(undefined);

    await authService.register({
      email: 'alice@example.com',
      password: 'Password123',
      name: 'Alice',
      locale: 'ru',
    });

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com', name: 'Alice', locale: 'ru' }),
    );
    expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'ru',
    );
  });
});

describe('authService.login', () => {
  it('rejects an unknown email with INVALID_CREDENTIALS', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'ghost@example.com', password: 'x' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a wrong password with INVALID_CREDENTIALS — same code as unknown email (no account enumeration)', async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser());
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'alice@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('returns real tokens directly when 2FA is disabled', async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser({ twoFactorEnabled: false }));
    passwordHasher.compare.mockResolvedValue(true);

    const result = await authService.login({ email: 'alice@example.com', password: 'Password123' });

    expect('tokens' in result && result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(twoFactorCodeRepository.create).not.toHaveBeenCalled();
  });

  it('withholds real tokens and returns a masked email + two-factor token when 2FA is enabled', async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser({ twoFactorEnabled: true }));
    passwordHasher.compare.mockResolvedValue(true);
    twoFactorCodeRepository.deleteByUser.mockResolvedValue({} as never);
    twoFactorCodeRepository.create.mockResolvedValue({} as never);
    emailService.sendTwoFactorCode.mockResolvedValue(undefined);

    const result = await authService.login({ email: 'alice@example.com', password: 'Password123' });

    expect(result).toEqual({
      requiresTwoFactor: true,
      twoFactorToken: 'two-factor-token',
      email: 'a***e@example.com',
    });
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendTwoFactorCode).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'en',
    );
  });

  it("sends the two-factor code in the account's stored locale, not the default", async () => {
    userRepository.findByEmail.mockResolvedValue(
      makeUser({ twoFactorEnabled: true, locale: 'pl' }),
    );
    passwordHasher.compare.mockResolvedValue(true);
    twoFactorCodeRepository.deleteByUser.mockResolvedValue({} as never);
    twoFactorCodeRepository.create.mockResolvedValue({} as never);
    emailService.sendTwoFactorCode.mockResolvedValue(undefined);

    await authService.login({ email: 'alice@example.com', password: 'Password123' });

    expect(emailService.sendTwoFactorCode).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'pl',
    );
  });
});

describe('authService.twoFactorLogin', () => {
  it('rejects an invalid/expired two-factor session token', async () => {
    tokenService.verifyTwoFactorToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(authService.twoFactorLogin('bad-token', '123456')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TWO_FACTOR_TOKEN',
    });
  });

  it('rejects a wrong/expired code', async () => {
    tokenService.verifyTwoFactorToken.mockReturnValue('user_1');
    twoFactorCodeRepository.findValid.mockResolvedValue(null);

    await expect(authService.twoFactorLogin('token', '000000')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_VERIFICATION_CODE',
    });
  });

  it('issues real tokens once the token and code both check out', async () => {
    tokenService.verifyTwoFactorToken.mockReturnValue('user_1');
    twoFactorCodeRepository.findValid.mockResolvedValue({
      id: 'code_1',
      userId: 'user_1',
      code: '123456',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    userRepository.findById.mockResolvedValue(makeUser({ twoFactorEnabled: true }));
    twoFactorCodeRepository.deleteByUser.mockResolvedValue({} as never);

    const result = await authService.twoFactorLogin('token', '123456');

    expect(result.tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(twoFactorCodeRepository.deleteByUser).toHaveBeenCalledWith('user_1');
  });
});

describe('authService.setTwoFactor', () => {
  it('enables 2FA instantly with no code required', async () => {
    userRepository.update.mockResolvedValue(makeUser({ twoFactorEnabled: true }));

    const result = await authService.setTwoFactor('user_1', true);

    expect(result.twoFactorEnabled).toBe(true);
    expect(twoFactorCodeRepository.findValid).not.toHaveBeenCalled();
    expect(userRepository.update).toHaveBeenCalledWith('user_1', { twoFactorEnabled: true });
  });

  it('rejects disabling 2FA with no code with VERIFICATION_CODE_REQUIRED', async () => {
    await expect(authService.setTwoFactor('user_1', false)).rejects.toMatchObject({
      statusCode: 422,
      code: 'VERIFICATION_CODE_REQUIRED',
    });
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('rejects disabling 2FA with a wrong/expired code with INVALID_VERIFICATION_CODE', async () => {
    twoFactorCodeRepository.findValid.mockResolvedValue(null);

    await expect(authService.setTwoFactor('user_1', false, '000000')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_VERIFICATION_CODE',
    });
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('disables 2FA and consumes the code once it checks out', async () => {
    twoFactorCodeRepository.findValid.mockResolvedValue({
      id: 'code_1',
      userId: 'user_1',
      code: '123456',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    twoFactorCodeRepository.deleteByUser.mockResolvedValue({} as never);
    userRepository.update.mockResolvedValue(makeUser({ twoFactorEnabled: false }));

    const result = await authService.setTwoFactor('user_1', false, '123456');

    expect(result.twoFactorEnabled).toBe(false);
    expect(twoFactorCodeRepository.deleteByUser).toHaveBeenCalledWith('user_1');
    expect(userRepository.update).toHaveBeenCalledWith('user_1', { twoFactorEnabled: false });
  });
});

describe('authService.requestDisableTwoFactor', () => {
  it('rejects when 2FA is already disabled with TWO_FACTOR_NOT_ENABLED', async () => {
    userRepository.findById.mockResolvedValue(makeUser({ twoFactorEnabled: false }));

    await expect(authService.requestDisableTwoFactor('user_1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'TWO_FACTOR_NOT_ENABLED',
    });
    expect(twoFactorCodeRepository.create).not.toHaveBeenCalled();
  });

  it('creates and emails a code when 2FA is enabled', async () => {
    userRepository.findById.mockResolvedValue(makeUser({ twoFactorEnabled: true }));
    twoFactorCodeRepository.deleteByUser.mockResolvedValue({} as never);
    twoFactorCodeRepository.create.mockResolvedValue({} as never);
    emailService.sendTwoFactorCode.mockResolvedValue(undefined);

    await authService.requestDisableTwoFactor('user_1');

    expect(twoFactorCodeRepository.deleteByUser).toHaveBeenCalledWith('user_1');
    expect(twoFactorCodeRepository.create).toHaveBeenCalledWith(
      'user_1',
      expect.any(String),
      expect.any(Date),
    );
    expect(emailService.sendTwoFactorCode).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'en',
    );
  });
});

describe('authService.forgotPassword', () => {
  it('does not create a reset token or throw for an unknown email — avoids leaking account existence', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      authService.forgotPassword('ghost@example.com', 'http://localhost:3000'),
    ).resolves.toBeUndefined();
    expect(passwordResetRepository.create).not.toHaveBeenCalled();
  });

  it('creates a reset token and emails a link scoped to the request origin for a known account', async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser());
    passwordResetRepository.deleteByUser.mockResolvedValue({} as never);
    passwordResetRepository.create.mockResolvedValue({} as never);
    emailService.sendPasswordResetLink.mockResolvedValue(undefined);

    await authService.forgotPassword('alice@example.com', 'http://192.168.1.11:3000');

    expect(passwordResetRepository.create).toHaveBeenCalledWith(
      'user_1',
      expect.any(String),
      expect.any(Date),
    );
    expect(emailService.sendPasswordResetLink).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.stringContaining('http://192.168.1.11:3000/reset-password?token='),
      'en',
    );
  });

  it("emails the reset link in the account's stored locale", async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser({ locale: 'ru' }));
    passwordResetRepository.deleteByUser.mockResolvedValue({} as never);
    passwordResetRepository.create.mockResolvedValue({} as never);
    emailService.sendPasswordResetLink.mockResolvedValue(undefined);

    await authService.forgotPassword('alice@example.com', 'http://192.168.1.11:3000');

    expect(emailService.sendPasswordResetLink).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'ru',
    );
  });
});

describe('authService.resetPassword', () => {
  it('rejects an invalid/expired token', async () => {
    passwordResetRepository.findValid.mockResolvedValue(null);

    await expect(authService.resetPassword('bad-token', 'NewPassword123')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_RESET_LINK',
    });
  });

  it('hashes the new password and invalidates every existing session on success', async () => {
    passwordResetRepository.findValid.mockResolvedValue({
      id: 'reset_1',
      userId: 'user_1',
      token: 'good-token',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    passwordHasher.hash.mockResolvedValue('new-hashed-password');
    userRepository.update.mockResolvedValue(makeUser());
    passwordResetRepository.deleteByUser.mockResolvedValue({} as never);
    refreshTokenRepository.deleteAllForUser.mockResolvedValue({} as never);

    await authService.resetPassword('good-token', 'NewPassword123');

    expect(passwordHasher.hash).toHaveBeenCalledWith('NewPassword123');
    expect(userRepository.update).toHaveBeenCalledWith('user_1', {
      password: 'new-hashed-password',
    });
    expect(refreshTokenRepository.deleteAllForUser).toHaveBeenCalledWith('user_1');
  });
});

describe('authService.changePassword', () => {
  it('rejects an incorrect current password without touching the stored one', async () => {
    userRepository.findById.mockResolvedValue(makeUser());
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      authService.changePassword('user_1', 'wrong-current', 'NewPassword123'),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INCORRECT_CURRENT_PASSWORD',
    });
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('updates the password and invalidates every session when the current password matches', async () => {
    userRepository.findById.mockResolvedValue(makeUser());
    passwordHasher.compare.mockResolvedValue(true);
    passwordHasher.hash.mockResolvedValue('new-hashed-password');
    userRepository.update.mockResolvedValue(makeUser());
    refreshTokenRepository.deleteAllForUser.mockResolvedValue({} as never);

    await authService.changePassword('user_1', 'current', 'NewPassword123');

    expect(userRepository.update).toHaveBeenCalledWith('user_1', {
      password: 'new-hashed-password',
    });
    expect(refreshTokenRepository.deleteAllForUser).toHaveBeenCalledWith('user_1');
  });
});

describe('authService.resendVerification', () => {
  it("resends the code in the account's stored locale, falling back to en when unset", async () => {
    userRepository.findPublic.mockResolvedValue({
      id: 'user_1',
      email: 'alice@example.com',
      name: 'Alice',
      avatar: null,
      bio: null,
      isEmailVerified: false,
      locale: '',
      createdAt: new Date('2026-01-01'),
    });
    emailVerificationRepository.deleteByUser.mockResolvedValue({} as never);
    emailVerificationRepository.create.mockResolvedValue({} as never);
    emailService.sendVerificationCode.mockResolvedValue(undefined);

    await authService.resendVerification('user_1');

    expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'en',
    );
  });

  it("resends the code in the account's stored locale when it is a supported one", async () => {
    userRepository.findPublic.mockResolvedValue({
      id: 'user_1',
      email: 'alice@example.com',
      name: 'Alice',
      avatar: null,
      bio: null,
      isEmailVerified: false,
      locale: 'pl',
      createdAt: new Date('2026-01-01'),
    });
    emailVerificationRepository.deleteByUser.mockResolvedValue({} as never);
    emailVerificationRepository.create.mockResolvedValue({} as never);
    emailService.sendVerificationCode.mockResolvedValue(undefined);

    await authService.resendVerification('user_1');

    expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      expect.any(String),
      'pl',
    );
  });
});
