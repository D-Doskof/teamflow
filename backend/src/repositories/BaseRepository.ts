import { PrismaClient } from '@prisma/client';

// Shared plumbing, not shared business logic — just wires in the Prisma client so each
// repository stays testable and swappable behind its own interface.
export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaClient) {}
}
