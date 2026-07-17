import { INotificationRepository } from '../repositories/notification.repository';
import { IInvitationRepository } from '../repositories/invitation.repository';
import { buildPaginationMeta } from '../utils/pagination.util';

export interface INotificationService {
  create(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): ReturnType<INotificationRepository['create']>;
  findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    notifications: Awaited<ReturnType<INotificationRepository['findByUser']>>['notifications'];
    meta: ReturnType<typeof buildPaginationMeta>;
    unreadCount: number;
  }>;
  markAsRead(
    notificationId: string,
    userId: string,
  ): ReturnType<INotificationRepository['markAsRead']>;
  markAllAsRead(userId: string): ReturnType<INotificationRepository['markAllAsRead']>;
  delete(notificationId: string, userId: string): ReturnType<INotificationRepository['delete']>;
  countUnread(userId: string): Promise<number>;
}

export class NotificationService implements INotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly invitationRepository: IInvitationRepository,
  ) {}

  create(userId: string, title: string, message: string, data?: Record<string, unknown>) {
    return this.notificationRepository.create(userId, title, message, data);
  }

  async findByUser(userId: string, page: number, limit: number) {
    const [{ notifications, total }, unreadCount] = await Promise.all([
      this.notificationRepository.findByUser(userId, page, limit),
      this.notificationRepository.countUnread(userId),
    ]);

    // Enrich with the invitation's current status, not the status at notification-creation
    // time, so an already-declined/accepted invite doesn't still show live Accept/Decline.
    const invitationIds = notifications
      .filter((n) => n.type === 'INVITATION')
      .map((n) => (n.data as { invitationId?: string } | null)?.invitationId)
      .filter((id): id is string => Boolean(id));
    const statuses = await this.invitationRepository.findStatusesByIds(invitationIds);
    const statusById = new Map(statuses.map((s) => [s.id, s.status]));

    const enriched = notifications.map((n) => {
      if (n.type !== 'INVITATION') return n;
      const data = n.data as { invitationId?: string } | null;
      const invitationStatus = data?.invitationId
        ? (statusById.get(data.invitationId) ?? null)
        : null;
      return { ...n, data: { ...data, invitationStatus } };
    });

    return { notifications: enriched, meta: buildPaginationMeta(total, page, limit), unreadCount };
  }

  markAsRead(notificationId: string, userId: string) {
    return this.notificationRepository.markAsRead(notificationId, userId);
  }

  markAllAsRead(userId: string) {
    return this.notificationRepository.markAllAsRead(userId);
  }

  delete(notificationId: string, userId: string) {
    return this.notificationRepository.delete(notificationId, userId);
  }

  countUnread(userId: string) {
    return this.notificationRepository.countUnread(userId);
  }
}
