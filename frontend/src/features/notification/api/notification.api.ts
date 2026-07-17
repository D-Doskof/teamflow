import { api } from '@/lib/axios';
import { ApiResponse, Notification, PaginationMeta } from '@/types';

export const notificationApi = {
  getAll: (page = 1, limit = 20) =>
    api
      .get<ApiResponse<Notification[]> & { meta?: PaginationMeta }>('/notifications', {
        params: { page, limit },
      })
      .then((r) => r.data),

  getUnreadCount: () =>
    api
      .get<ApiResponse<{ count: number }>>('/notifications/unread-count')
      .then((r) => r.data.data!.count),

  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllAsRead: () => api.post('/notifications/mark-all-read'),

  delete: (id: string) => api.delete(`/notifications/${id}`),
};
