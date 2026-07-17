import { Prisma, Role, Workspace, WorkspaceMember } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

const workspaceWithCountsArgs = Prisma.validator<Prisma.WorkspaceDefaultArgs>()({
  include: {
    members: { select: { role: true, userId: true } },
    _count: { select: { projects: true, members: true } },
  },
});
export type WorkspaceWithCounts = Prisma.WorkspaceGetPayload<typeof workspaceWithCountsArgs>;

const memberWithUserArgs = Prisma.validator<Prisma.WorkspaceMemberDefaultArgs>()({
  include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
});
export type MemberWithUser = Prisma.WorkspaceMemberGetPayload<typeof memberWithUserArgs>;

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

export interface IWorkspaceRepository {
  findBySlug(slug: string): Promise<Workspace | null>;
  findById(id: string): Promise<Workspace | null>;
  create(data: Prisma.WorkspaceCreateInput): Promise<Workspace>;
  update(id: string, data: Prisma.WorkspaceUpdateInput): Promise<Workspace>;
  delete(id: string): Promise<Workspace>;
  findUserWorkspaces(userId: string): Promise<WorkspaceWithCounts[]>;
  findMembers(workspaceId: string): Promise<MemberWithUser[]>;
  countMembers(workspaceId: string): Promise<number>;
  findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  addMember(workspaceId: string, userId: string, role?: Role): Promise<WorkspaceMember>;
  updateMemberRole(workspaceId: string, userId: string, role: string): Promise<WorkspaceMember>;
  removeMember(workspaceId: string, userId: string): Promise<WorkspaceMember>;
  isSlugTaken(slug: string, excludeId?: string): Promise<Workspace | null>;
  updateMemberCustomPermissions(
    workspaceId: string,
    userId: string,
    customPermissions: Record<string, unknown> | null,
  ): Promise<MemberWithUser>;
  getStats(workspaceId: string): Promise<WorkspaceStats>;
}

export class WorkspaceRepository extends BaseRepository implements IWorkspaceRepository {
  findBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { id } });
  }

  create(data: Prisma.WorkspaceCreateInput): Promise<Workspace> {
    return this.prisma.workspace.create({ data });
  }

  update(id: string, data: Prisma.WorkspaceUpdateInput): Promise<Workspace> {
    return this.prisma.workspace.update({ where: { id }, data });
  }

  delete(id: string): Promise<Workspace> {
    return this.prisma.workspace.delete({ where: { id } });
  }

  findUserWorkspaces(userId: string): Promise<WorkspaceWithCounts[]> {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      ...workspaceWithCountsArgs,
      orderBy: { createdAt: 'desc' },
    });
  }

  findMembers(workspaceId: string): Promise<MemberWithUser[]> {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      ...memberWithUserArgs,
      orderBy: { joinedAt: 'asc' },
    });
  }

  countMembers(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({ where: { workspaceId } });
  }

  findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  addMember(workspaceId: string, userId: string, role: Role = 'MEMBER'): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
  }

  updateMemberRole(workspaceId: string, userId: string, role: string): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role: role as Role },
    });
  }

  removeMember(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  isSlugTaken(slug: string, excludeId?: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
  }

  updateMemberCustomPermissions(
    workspaceId: string,
    userId: string,
    customPermissions: Record<string, unknown> | null,
  ): Promise<MemberWithUser> {
    return this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: {
        customPermissions:
          customPermissions !== null ? (customPermissions as Prisma.InputJsonValue) : Prisma.DbNull,
      },
      ...memberWithUserArgs,
    });
  }

  async getStats(workspaceId: string): Promise<WorkspaceStats> {
    // Filter through the relation chain directly instead of resolving project ->
    // board -> taskList ids in three sequential round trips.
    const [tasks, members, totalProjects, totalBoards] = await Promise.all([
      this.prisma.task.findMany({
        where: { taskList: { board: { project: { workspaceId } } } },
        select: { status: true, priority: true, dueDate: true },
      }),
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.project.count({ where: { workspaceId } }),
      this.prisma.board.count({ where: { project: { workspaceId } } }),
    ]);

    const now = new Date();
    return {
      totalTasks: tasks.length,
      doneTasks: tasks.filter((t) => t.status === 'DONE').length,
      inProgressTasks: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      todoTasks: tasks.filter((t) => t.status === 'TODO').length,
      overdueTasks: tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== 'DONE').length,
      totalProjects,
      totalBoards,
      totalMembers: members,
      byPriority: tasks.reduce(
        (acc, t) => {
          acc[t.priority] = (acc[t.priority] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byStatus: tasks.reduce(
        (acc, t) => {
          acc[t.status] = (acc[t.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
