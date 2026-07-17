import { Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

const SEARCH_RESULT_LIMIT = 8;

const taskSearchArgs = Prisma.validator<Prisma.TaskDefaultArgs>()({
  select: {
    id: true,
    title: true,
    priority: true,
    status: true,
    taskList: {
      select: {
        boardId: true,
        board: {
          select: {
            name: true,
            projectId: true,
            project: {
              select: {
                name: true,
                workspace: { select: { slug: true } },
              },
            },
          },
        },
      },
    },
  },
});
export type TaskSearchRow = Prisma.TaskGetPayload<typeof taskSearchArgs>;

const projectSearchArgs = Prisma.validator<Prisma.ProjectDefaultArgs>()({
  select: {
    id: true,
    name: true,
    color: true,
    workspace: { select: { id: true, name: true, slug: true } },
  },
});
export type ProjectSearchRow = Prisma.ProjectGetPayload<typeof projectSearchArgs>;

const boardSearchArgs = Prisma.validator<Prisma.BoardDefaultArgs>()({
  select: {
    id: true,
    name: true,
    projectId: true,
    project: {
      select: {
        name: true,
        workspace: { select: { slug: true } },
      },
    },
  },
});
export type BoardSearchRow = Prisma.BoardGetPayload<typeof boardSearchArgs>;

export interface ISearchRepository {
  searchTasks(userId: string, query: string, limit?: number): Promise<TaskSearchRow[]>;
  searchProjects(userId: string, query: string, limit?: number): Promise<ProjectSearchRow[]>;
  searchBoards(userId: string, query: string, limit?: number): Promise<BoardSearchRow[]>;
}

// Every query is scoped through `workspace.members.some({ userId })` since results span
// workspaces and there's no per-route role guard to enforce this authz boundary otherwise.
export class SearchRepository extends BaseRepository implements ISearchRepository {
  searchTasks(
    userId: string,
    query: string,
    limit = SEARCH_RESULT_LIMIT,
  ): Promise<TaskSearchRow[]> {
    return this.prisma.task.findMany({
      where: {
        title: { contains: query, mode: 'insensitive' },
        taskList: { board: { project: { workspace: { members: { some: { userId } } } } } },
      },
      ...taskSearchArgs,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  searchProjects(
    userId: string,
    query: string,
    limit = SEARCH_RESULT_LIMIT,
  ): Promise<ProjectSearchRow[]> {
    return this.prisma.project.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        isArchived: false,
        workspace: { members: { some: { userId } } },
      },
      ...projectSearchArgs,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  searchBoards(
    userId: string,
    query: string,
    limit = SEARCH_RESULT_LIMIT,
  ): Promise<BoardSearchRow[]> {
    return this.prisma.board.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        project: { workspace: { members: { some: { userId } } } },
      },
      ...boardSearchArgs,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
