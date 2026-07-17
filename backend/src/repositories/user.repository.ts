import { Prisma, User } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

const publicUserSelect = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    id: true,
    email: true,
    name: true,
    avatar: true,
    bio: true,
    isEmailVerified: true,
    locale: true,
    createdAt: true,
  },
});
export type PublicUser = Prisma.UserGetPayload<typeof publicUserSelect>;

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: Prisma.UserCreateInput): Promise<User>;
  update(id: string, data: Prisma.UserUpdateInput): Promise<User>;
  findPublic(id: string): Promise<PublicUser | null>;
}

export class UserRepository extends BaseRepository implements IUserRepository {
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  findPublic(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, ...publicUserSelect });
  }
}
