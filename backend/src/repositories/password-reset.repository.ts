import { PasswordReset, Prisma } from '@prisma/client';
import { hashToken } from '../utils/hash.util';
import { BaseRepository } from './BaseRepository';

export interface IPasswordResetRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<PasswordReset>;
  findValid(token: string): Promise<PasswordReset | null>;
  deleteByUser(userId: string): Promise<Prisma.BatchPayload>;
}

export class PasswordResetRepository extends BaseRepository implements IPasswordResetRepository {
  // Only the hash is persisted — the raw token only ever lives in the emailed link.
  create(userId: string, token: string, expiresAt: Date): Promise<PasswordReset> {
    return this.prisma.passwordReset.create({
      data: { userId, token: hashToken(token), expiresAt },
    });
  }

  findValid(token: string): Promise<PasswordReset | null> {
    return this.prisma.passwordReset.findFirst({
      where: { token: hashToken(token), expiresAt: { gt: new Date() } },
    });
  }

  deleteByUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.passwordReset.deleteMany({ where: { userId } });
  }
}
