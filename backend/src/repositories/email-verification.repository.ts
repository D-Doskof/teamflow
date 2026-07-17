import { EmailVerification, Prisma } from '@prisma/client';
import { hashToken } from '../utils/hash.util';
import { BaseRepository } from './BaseRepository';

export interface IEmailVerificationRepository {
  create(userId: string, code: string, expiresAt: Date): Promise<EmailVerification>;
  findValid(userId: string, code: string): Promise<EmailVerification | null>;
  deleteByUser(userId: string): Promise<Prisma.BatchPayload>;
}

export class EmailVerificationRepository
  extends BaseRepository
  implements IEmailVerificationRepository
{
  create(userId: string, code: string, expiresAt: Date): Promise<EmailVerification> {
    return this.prisma.emailVerification.create({
      data: { userId, code: hashToken(code), expiresAt },
    });
  }

  findValid(userId: string, code: string): Promise<EmailVerification | null> {
    return this.prisma.emailVerification.findFirst({
      where: { userId, code: hashToken(code), expiresAt: { gt: new Date() } },
    });
  }

  deleteByUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.emailVerification.deleteMany({ where: { userId } });
  }
}
