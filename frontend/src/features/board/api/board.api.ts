import { api } from '@/lib/axios';
import { ApiResponse, Board } from '@/types';

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };

export const boardApi = {
  getByProject: (workspaceSlug: string, projectId: string) =>
    api
      .get<ApiResponse<Board[]>>(`/workspaces/${workspaceSlug}/projects/${projectId}/boards`)
      .then((r) => r.data.data!),

  getById: (workspaceSlug: string, projectId: string, boardId: string) =>
    api
      .get<ApiResponse<Board>>(
        `/workspaces/${workspaceSlug}/projects/${projectId}/boards/${boardId}`,
      )
      .then((r) => r.data.data!),

  create: (
    workspaceSlug: string,
    projectId: string,
    data: { name: string; description?: string },
  ) =>
    api
      .post<ApiResponse<Board>>(`/workspaces/${workspaceSlug}/projects/${projectId}/boards`, data)
      .then((r) => r.data.data!),

  createList: (p: BoardPath, data: { name: string }) =>
    api
      .post<ApiResponse<{ id: string; name: string; position: number; color: string | null }>>(
        `/workspaces/${p.workspaceSlug}/projects/${p.projectId}/boards/${p.boardId}/lists`,
        data,
      )
      .then((r) => r.data.data!),

  updateList: (p: BoardPath, listId: string, data: { name?: string }) =>
    api
      .patch<ApiResponse<{ id: string; name: string }>>(
        `/workspaces/${p.workspaceSlug}/projects/${p.projectId}/boards/${p.boardId}/lists/${listId}`,
        data,
      )
      .then((r) => r.data.data!),

  deleteList: (p: BoardPath, listId: string) =>
    api.delete(
      `/workspaces/${p.workspaceSlug}/projects/${p.projectId}/boards/${p.boardId}/lists/${listId}`,
    ),
};
