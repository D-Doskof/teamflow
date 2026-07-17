import { Prisma, TwoFactorCode } from '@prisma/client';
import { hashToken } from '../utils/hash.util';
import { BaseRepository } from './BaseRepository';

export interface ITwoFactorCodeRepository {
  create(userId: string, code: string, expiresAt: Date): Promise<TwoFactorCode>;
  findValid(userId: string, code: string): Promise<TwoFactorCode | null>;
  deleteByUser(userId: string): Promise<Prisma.BatchPayload>;
}

export class TwoFactorCodeRepository extends BaseRepository implements ITwoFactorCodeRepository {
  create(userId: string, code: string, expiresAt: Date): Promise<TwoFactorCode> {
    return this.prisma.twoFactorCode.create({ data: { userId, code: hashToken(code), expiresAt } });
  }

  findValid(userId: string, code: string): Promise<TwoFactorCode | null> {
    return this.prisma.twoFactorCode.findFirst({
      where: { userId, code: hashToken(code), expiresAt: { gt: new Date() } },
    });
  }

  deleteByUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.twoFactorCode.deleteMany({ where: { userId } });
  }
}
