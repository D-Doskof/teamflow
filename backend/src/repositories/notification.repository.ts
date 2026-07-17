import { Notification, NotificationType, Prisma } from '@prisma/client';
import { getPaginationParams } from '../utils/pagination.util';
import { BaseRepository } from './BaseRepository';

export interface INotificationRepository {
  create(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<Notification>;
  createWithType(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<Notification>;
  findByUser(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<{ notifications: Notification[]; total: number }>;
  markAsRead(id: string, userId: string): Promise<Prisma.BatchPayload>;
  markAllAsRead(userId: string): Promise<Prisma.BatchPayload>;
  countUnread(userId: string): Promise<number>;
  delete(id: string, userId: string): Promise<Prisma.BatchPayload>;
}

export class NotificationRepository extends BaseRepository implements INotificationRepository {
  create(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title,
        message,
        data: data as Prisma.InputJsonValue | undefined,
      },
    });
  }

  createWithType(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    return this.prisma.notification.create({
      data: { userId, type, title, message, data: data as Prisma.InputJsonValue | undefined },
    });
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { skip, take } = getPaginationParams({ page, limit });
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, total };
  }

  markAsRead(id: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  }

  markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  delete(id: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }
}
