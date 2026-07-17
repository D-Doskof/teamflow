import { api } from '@/lib/axios';
import { ApiResponse, Project, Label } from '@/types';

export const projectApi = {
  getByWorkspace: (workspaceSlug: string) =>
    api
      .get<ApiResponse<Project[]>>(`/workspaces/${workspaceSlug}/projects`)
      .then((r) => r.data.data!),

  getById: (workspaceSlug: string, projectId: string) =>
    api
      .get<ApiResponse<Project>>(`/workspaces/${workspaceSlug}/projects/${projectId}`)
      .then((r) => r.data.data!),

  create: (workspaceSlug: string, data: { name: string; description?: string; color?: string }) =>
    api
      .post<ApiResponse<Project>>(`/workspaces/${workspaceSlug}/projects`, data)
      .then((r) => r.data.data!),

  update: (workspaceSlug: string, projectId: string, data: Partial<Project>) =>
    api
      .patch<ApiResponse<Project>>(`/workspaces/${workspaceSlug}/projects/${projectId}`, data)
      .then((r) => r.data.data!),

  archive: (workspaceSlug: string, projectId: string) =>
    api.post(`/workspaces/${workspaceSlug}/projects/${projectId}/archive`),

  delete: (workspaceSlug: string, projectId: string) =>
    api.delete(`/workspaces/${workspaceSlug}/projects/${projectId}`),

  getLabels: (workspaceSlug: string, projectId: string) =>
    api
      .get<ApiResponse<Label[]>>(`/workspaces/${workspaceSlug}/projects/${projectId}/labels`)
      .then((r) => r.data.data!),

  createLabel: (workspaceSlug: string, projectId: string, data: { name: string; color: string }) =>
    api
      .post<ApiResponse<Label>>(`/workspaces/${workspaceSlug}/projects/${projectId}/labels`, data)
      .then((r) => r.data.data!),

  updateLabel: (
    workspaceSlug: string,
    projectId: string,
    labelId: string,
    data: { name?: string; color?: string },
  ) =>
    api
      .patch<ApiResponse<Label>>(
        `/workspaces/${workspaceSlug}/projects/${projectId}/labels/${labelId}`,
        data,
      )
      .then((r) => r.data.data!),

  deleteLabel: (workspaceSlug: string, projectId: string, labelId: string) =>
    api.delete(`/workspaces/${workspaceSlug}/projects/${projectId}/labels/${labelId}`),
};
