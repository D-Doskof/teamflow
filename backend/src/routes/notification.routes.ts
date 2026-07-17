import { Router } from 'express';
import { notificationController } from '../container';
import { authenticate } from '../middlewares/auth.middleware';

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/', notificationController.findAll);
notificationRouter.get('/unread-count', notificationController.getUnreadCount);
notificationRouter.post('/mark-all-read', notificationController.markAllAsRead);
notificationRouter.patch('/:notificationId/read', notificationController.markAsRead);
notificationRouter.delete('/:notificationId', notificationController.delete);
