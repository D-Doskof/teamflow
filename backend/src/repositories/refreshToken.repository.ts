import { Prisma, RefreshToken, User } from '@prisma/client';
import { hashToken } from '../utils/hash.util';
import { BaseRepository } from './BaseRepository';

export type RefreshTokenWithUser = RefreshToken & { user: User };

export interface IRefreshTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<RefreshToken>;
  findByToken(token: string): Promise<RefreshTokenWithUser | null>;
  deleteByToken(token: string): Promise<Prisma.BatchPayload>;
  deleteAllForUser(userId: string): Promise<Prisma.BatchPayload>;
  deleteExpired(): Promise<Prisma.BatchPayload>;
}

export class RefreshTokenRepository extends BaseRepository implements IRefreshTokenRepository {
  // Only the SHA-256 hash of the token is ever persisted — a DB leak alone shouldn't
  // hand over usable sessions. Callers keep working with the raw JWT throughout.
  create(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: { userId, token: hashToken(token), expiresAt },
    });
  }

  findByToken(token: string): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token: hashToken(token) },
      include: { user: true },
    });
  }

  // deleteMany instead of delete: a concurrent request may have already consumed
  // (and deleted) this token — that's not an error, just a no-op here.
  deleteByToken(token: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.deleteMany({ where: { token: hashToken(token) } });
  }

  deleteAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  deleteExpired(): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
