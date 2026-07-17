import { api } from '@/lib/axios';
import { ApiResponse, Task, Comment, Subtask, Attachment, PaginationMeta } from '@/types';

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };

function boardBase({ workspaceSlug, projectId, boardId }: BoardPath) {
  return `/workspaces/${workspaceSlug}/projects/${projectId}/boards/${boardId}`;
}

interface TaskFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
  assigneeId?: string;
  labelId?: string;
}

export const taskApi = {
  getByBoard: (path: BoardPath, filters?: TaskFilters) =>
    api
      .get<ApiResponse<Task[]> & { meta?: PaginationMeta }>(`${boardBase(path)}/tasks`, {
        params: filters,
      })
      .then((r) => r.data),

  getById: (path: BoardPath, taskId: string) =>
    api.get<ApiResponse<Task>>(`${boardBase(path)}/tasks/${taskId}`).then((r) => r.data.data!),

  create: (
    path: BoardPath,
    taskListId: string,
    data: { title: string; description?: string; priority?: string; dueDate?: string },
  ) =>
    api
      .post<ApiResponse<Task>>(`${boardBase(path)}/tasks/list/${taskListId}`, data)
      .then((r) => r.data.data!),

  update: (path: BoardPath, taskId: string, data: Partial<Task> & { taskListId?: string }) =>
    api
      .patch<ApiResponse<Task>>(`${boardBase(path)}/tasks/${taskId}`, data)
      .then((r) => r.data.data!),

  delete: (path: BoardPath, taskId: string) => api.delete(`${boardBase(path)}/tasks/${taskId}`),

  addAssignee: (path: BoardPath, taskId: string, userId: string) =>
    api.post(`${boardBase(path)}/tasks/${taskId}/assignees`, { userId }).then((r) => r.data.data),

  removeAssignee: (path: BoardPath, taskId: string, userId: string) =>
    api.delete(`${boardBase(path)}/tasks/${taskId}/assignees/${userId}`),

  addLabel: (path: BoardPath, taskId: string, labelId: string) =>
    api
      .post<ApiResponse<Task>>(`${boardBase(path)}/tasks/${taskId}/labels/${labelId}`)
      .then((r) => r.data.data!),

  removeLabel: (path: BoardPath, taskId: string, labelId: string) =>
    api
      .delete<ApiResponse<Task>>(`${boardBase(path)}/tasks/${taskId}/labels/${labelId}`)
      .then((r) => r.data.data!),

  getComments: (path: BoardPath, taskId: string) =>
    api
      .get<ApiResponse<Comment[]>>(`${boardBase(path)}/tasks/${taskId}/comments`)
      .then((r) => r.data.data!),

  addComment: (path: BoardPath, taskId: string, content: string) =>
    api
      .post<ApiResponse<Comment>>(`${boardBase(path)}/tasks/${taskId}/comments`, { content })
      .then((r) => r.data.data!),

  updateComment: (path: BoardPath, taskId: string, commentId: string, content: string) =>
    api
      .patch<ApiResponse<Comment>>(`${boardBase(path)}/tasks/${taskId}/comments/${commentId}`, {
        content,
      })
      .then((r) => r.data.data!),

  deleteComment: (path: BoardPath, taskId: string, commentId: string) =>
    api.delete(`${boardBase(path)}/tasks/${taskId}/comments/${commentId}`),

  // Subtasks
  getSubtasks: (path: BoardPath, taskId: string) =>
    api
      .get<ApiResponse<Subtask[]>>(`${boardBase(path)}/tasks/${taskId}/subtasks`)
      .then((r) => r.data.data!),

  createSubtask: (path: BoardPath, taskId: string, title: string) =>
    api
      .post<ApiResponse<Subtask>>(`${boardBase(path)}/tasks/${taskId}/subtasks`, { title })
      .then((r) => r.data.data!),

  updateSubtask: (
    path: BoardPath,
    taskId: string,
    subtaskId: string,
    data: { title?: string; completed?: boolean },
  ) =>
    api
      .patch<ApiResponse<Subtask>>(`${boardBase(path)}/tasks/${taskId}/subtasks/${subtaskId}`, data)
      .then((r) => r.data.data!),

  deleteSubtask: (path: BoardPath, taskId: string, subtaskId: string) =>
    api.delete(`${boardBase(path)}/tasks/${taskId}/subtasks/${subtaskId}`),

  // Attachments (base64-based for mock server)
  getAttachments: (path: BoardPath, taskId: string) =>
    api
      .get<ApiResponse<Attachment[]>>(`${boardBase(path)}/tasks/${taskId}/attachments`)
      .then((r) => r.data.data!),

  uploadAttachment: (path: BoardPath, taskId: string, file: File): Promise<Attachment> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        api
          .post<ApiResponse<Attachment>>(`${boardBase(path)}/tasks/${taskId}/attachments`, {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data: reader.result as string,
          })
          .then((r) => resolve(r.data.data!))
          .catch(reject);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    }),

  getAttachment: (path: BoardPath, taskId: string, attachmentId: string) =>
    api
      .get<ApiResponse<Attachment>>(
        `${boardBase(path)}/tasks/${taskId}/attachments/${attachmentId}`,
      )
      .then((r) => r.data.data!),

  deleteAttachment: (path: BoardPath, taskId: string, attachmentId: string) =>
    api.delete(`${boardBase(path)}/tasks/${taskId}/attachments/${attachmentId}`),

  getActivity: (path: BoardPath, taskId: string) =>
    api
      .get<
        ApiResponse<
          Array<{
            id: string;
            action: string;
            field: string | null;
            oldValue: string | null;
            newValue: string | null;
            createdAt: string;
            user: { id: string; name: string; avatar: string | null } | null;
          }>
        >
      >(`${boardBase(path)}/tasks/${taskId}/activity`)
      .then((r) => r.data.data!),
};
