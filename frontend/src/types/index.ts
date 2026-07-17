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

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  // Site language last persisted server-side, used to pick the language for transactional
  // emails. Kept as a plain string (not the frontend's `Locale` union) since this type
  // describes the API response shape, and the backend validates the value.
  locale: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  createdAt: string;
  _count?: { projects: number; members: number };
}

export interface MemberPermissions {
  canEditContent: boolean;
  canDeleteContent: boolean;
  canManageMembers: boolean;
  canManageAdmins: boolean;
  canComment: boolean;
}

export interface WorkspaceMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatar'>;
  permissions: MemberPermissions;
  customPermissions?: Partial<MemberPermissions> | null;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  createdAt: string;
  _count?: { boards: number; members: number };
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  position: number;
  taskLists: TaskList[];
}

export interface TaskList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  color: string | null;
  tasks: Task[];
}

export interface Task {
  id: string;
  taskListId: string;
  title: string;
  description: string | null;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  position: number;
  dueDate: string | null;
  assignees: TaskAssignee[];
  labels: TaskLabelEntry[];
  _count?: { comments: number; attachments: number; subtasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  data?: string | null;
}

export interface TaskAssignee {
  id: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface TaskLabelEntry {
  id: string;
  label: Label;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface Notification {
  id: string;
  type: 'SYSTEM' | 'TASK' | 'INVITATION' | 'COMMENT';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export type Priority = Task['priority'];
export type TaskStatus = Task['status'];
export type WorkspaceRole = WorkspaceMember['role'];
