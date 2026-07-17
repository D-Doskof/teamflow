import { Label, Prisma, Project } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

const projectWithBoardCountArgs = Prisma.validator<Prisma.ProjectDefaultArgs>()({
  include: { _count: { select: { boards: true } } },
});
export type ProjectWithBoardCount = Prisma.ProjectGetPayload<typeof projectWithBoardCountArgs>;

const projectWithDetailsArgs = Prisma.validator<Prisma.ProjectDefaultArgs>()({
  include: {
    workspace: { select: { id: true, name: true, slug: true } },
    boards: { orderBy: { position: 'asc' } },
    labels: true,
    _count: { select: { boards: true } },
  },
});
export type ProjectWithDetails = Prisma.ProjectGetPayload<typeof projectWithDetailsArgs>;

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  create(data: Prisma.ProjectCreateInput): Promise<Project>;
  update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project>;
  delete(id: string): Promise<Project>;
  findByWorkspace(workspaceId: string, includeArchived?: boolean): Promise<ProjectWithBoardCount[]>;
  findByIdWithDetails(id: string): Promise<ProjectWithDetails | null>;
  createLabel(projectId: string, name: string, color: string): Promise<Label>;
  findLabels(projectId: string): Promise<Label[]>;
  deleteLabel(id: string): Promise<Label>;
}

export class ProjectRepository extends BaseRepository implements IProjectRepository {
  findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data });
  }

  delete(id: string): Promise<Project> {
    return this.prisma.project.delete({ where: { id } });
  }

  findByWorkspace(workspaceId: string, includeArchived = false): Promise<ProjectWithBoardCount[]> {
    return this.prisma.project.findMany({
      where: { workspaceId, ...(!includeArchived ? { isArchived: false } : {}) },
      ...projectWithBoardCountArgs,
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdWithDetails(id: string): Promise<ProjectWithDetails | null> {
    return this.prisma.project.findUnique({ where: { id }, ...projectWithDetailsArgs });
  }

  createLabel(projectId: string, name: string, color: string): Promise<Label> {
    return this.prisma.label.create({ data: { projectId, name, color } });
  }

  findLabels(projectId: string): Promise<Label[]> {
    return this.prisma.label.findMany({ where: { projectId } });
  }

  deleteLabel(id: string): Promise<Label> {
    return this.prisma.label.delete({ where: { id } });
  }
}
