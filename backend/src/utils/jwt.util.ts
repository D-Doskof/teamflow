import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';

interface TwoFactorTokenPayload {
  userId: string;
  type: 'two-factor';
}

// Abstraction: auth.service.ts depends on this contract, not on the jsonwebtoken package
// directly — a DIP seam that also makes auth logic testable without real JWTs.
export interface ITokenService {
  signAccessToken(payload: Omit<JwtPayload, 'type'>): string;
  signRefreshToken(payload: Omit<JwtPayload, 'type'>): string;
  verifyAccessToken(token: string): JwtPayload;
  verifyRefreshToken(token: string): JwtPayload;
  signTwoFactorToken(userId: string): string;
  verifyTwoFactorToken(token: string): string;
}

export class TokenService implements ITokenService {
  signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  signRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  }

  verifyRefreshToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  }

  // Identifies a pending 2FA login (issued right after password check, before the code is
  // verified) — short-lived on purpose. Signed with JWT_REFRESH_SECRET (not the access
  // secret) so it can never verify successfully against authenticate()'s verifyAccessToken,
  // even if a `type` check were ever missing there.
  signTwoFactorToken(userId: string): string {
    return jwt.sign({ userId, type: 'two-factor' }, env.JWT_REFRESH_SECRET, { expiresIn: '10m' });
  }

  verifyTwoFactorToken(token: string): string {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    }) as TwoFactorTokenPayload;
    if (payload.type !== 'two-factor') throw new Error('Invalid token type');
    return payload.userId;
  }
}

export const tokenService: ITokenService = new TokenService();

// Shims: keep every existing `import { verifyAccessToken } from '../utils/jwt.util'` etc.
// working unchanged until callers are migrated to constructor-injected ITokenService.
export function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  return tokenService.signAccessToken(payload);
}

export function signRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
  return tokenService.signRefreshToken(payload);
}

export function verifyAccessToken(token: string): JwtPayload {
  return tokenService.verifyAccessToken(token);
}

export function verifyRefreshToken(token: string): JwtPayload {
  return tokenService.verifyRefreshToken(token);
}

export function signTwoFactorToken(userId: string): string {
  return tokenService.signTwoFactorToken(userId);
}

export function verifyTwoFactorToken(token: string): string {
  return tokenService.verifyTwoFactorToken(token);
}
