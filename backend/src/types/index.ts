import { Role, Priority, TaskStatus } from '@prisma/client';

export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface TaskFilterQuery extends PaginationQuery {
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  labelId?: string;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  type: 'access' | 'refresh';
}

export interface MemberPermissions {
  canEditContent: boolean;
  canDeleteContent: boolean;
  canManageMembers: boolean;
  canManageAdmins: boolean;
  canComment: boolean;
}

export type WorkspaceRole = Role;
export type ProjectRole = Role;

export { Role, Priority, TaskStatus };
