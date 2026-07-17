import { Request, Response } from 'express';
import { INotificationService } from '../services/notification.service';
import { sendSuccess, sendNoContent } from '../utils/response.util';

export class NotificationController {
  constructor(private readonly notificationService: INotificationService) {}

  findAll = async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await this.notificationService.findByUser(req.user!.id, page, limit);
    sendSuccess(res, result.notifications, 'OK', 200, result.meta);
  };

  markAsRead = async (req: Request, res: Response): Promise<void> => {
    await this.notificationService.markAsRead(req.params.notificationId, req.user!.id);
    sendSuccess(res, null, 'Marked as read');
  };

  markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    await this.notificationService.markAllAsRead(req.user!.id);
    sendSuccess(res, null, 'All notifications marked as read');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.notificationService.delete(req.params.notificationId, req.user!.id);
    sendNoContent(res);
  };

  getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    const count = await this.notificationService.countUnread(req.user!.id);
    sendSuccess(res, { count });
  };
}
