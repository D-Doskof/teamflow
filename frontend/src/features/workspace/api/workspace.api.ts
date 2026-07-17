import { api } from '@/lib/axios';
import { ApiResponse, MemberPermissions, Workspace, WorkspaceMember } from '@/types';

interface CreateWorkspaceDto {
  name: string;
  description?: string;
}

export interface WorkspaceStats {
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  totalProjects: number;
  totalBoards: number;
  totalMembers: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  workspaceId: string;
  invitedBy: string;
  createdAt: string;
  workspace?: { id: string; name: string; slug: string };
  inviterName?: string;
}

export const workspaceApi = {
  getAll: () => api.get<ApiResponse<Workspace[]>>('/workspaces').then((r) => r.data.data!),
  getBySlug: (slug: string) =>
    api.get<ApiResponse<Workspace>>(`/workspaces/${slug}`).then((r) => r.data.data!),
  create: (data: CreateWorkspaceDto) =>
    api.post<ApiResponse<Workspace>>('/workspaces', data).then((r) => r.data.data!),
  update: (slug: string, data: Partial<CreateWorkspaceDto>) =>
    api.patch<ApiResponse<Workspace>>(`/workspaces/${slug}`, data).then((r) => r.data.data!),
  delete: (slug: string) => api.delete(`/workspaces/${slug}`),

  getStats: (slug: string) =>
    api.get<ApiResponse<WorkspaceStats>>(`/workspaces/${slug}/stats`).then((r) => r.data.data!),

  getMembers: (slug: string) =>
    api
      .get<ApiResponse<WorkspaceMember[]>>(`/workspaces/${slug}/members`)
      .then((r) => r.data.data!),
  getMyPermissions: (slug: string) =>
    api
      .get<ApiResponse<MemberPermissions>>(`/workspaces/${slug}/me/permissions`)
      .then((r) => r.data.data!),
  updateMemberRole: (slug: string, userId: string, role: string) =>
    api
      .patch<ApiResponse<WorkspaceMember>>(`/workspaces/${slug}/members/${userId}`, { role })
      .then((r) => r.data.data!),
  removeMember: (slug: string, userId: string) =>
    api.delete(`/workspaces/${slug}/members/${userId}`),
  updateMemberPermissions: (
    slug: string,
    userId: string,
    body: Partial<MemberPermissions> & { reset?: boolean },
  ) =>
    api
      .patch<ApiResponse<WorkspaceMember>>(
        `/workspaces/${slug}/members/${userId}/permissions`,
        body,
      )
      .then((r) => r.data.data!),

  // Invitations
  sendInvitation: (slug: string, data: { email: string; role?: string }) =>
    api
      .post<ApiResponse<WorkspaceInvitation>>(`/workspaces/${slug}/invitations`, data)
      .then((r) => r.data.data!),
  getWorkspaceInvitations: (slug: string) =>
    api
      .get<ApiResponse<WorkspaceInvitation[]>>(`/workspaces/${slug}/invitations`)
      .then((r) => r.data.data!),
  cancelInvitation: (slug: string, invId: string) =>
    api.delete(`/workspaces/${slug}/invitations/${invId}`),
  getPendingInvitations: () =>
    api.get<ApiResponse<WorkspaceInvitation[]>>('/invitations/pending').then((r) => r.data.data!),
  acceptInvitation: (invId: string) =>
    api
      .post<ApiResponse<{ workspaceSlug: string }>>(`/invitations/${invId}/accept`)
      .then((r) => r.data.data!),
  declineInvitation: (invId: string) => api.post(`/invitations/${invId}/decline`),
};
