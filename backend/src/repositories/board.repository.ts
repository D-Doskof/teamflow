import { Board, Prisma, TaskList } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

const boardWithTaskListsAndTasksArgs = Prisma.validator<Prisma.BoardDefaultArgs>()({
  include: {
    taskLists: {
      orderBy: { position: 'asc' },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
            labels: { include: { label: true } },
            _count: { select: { comments: true, attachments: true } },
          },
        },
      },
    },
  },
});
export type BoardWithLists = Prisma.BoardGetPayload<typeof boardWithTaskListsAndTasksArgs>;

const boardWithTaskListCountsArgs = Prisma.validator<Prisma.BoardDefaultArgs>()({
  include: {
    taskLists: {
      orderBy: { position: 'asc' },
      include: { _count: { select: { tasks: true } } },
    },
  },
});
export type BoardWithListCounts = Prisma.BoardGetPayload<typeof boardWithTaskListCountsArgs>;

export interface ResolvedTaskListPath {
  workspaceSlug: string;
  projectId: string;
  boardId: string;
}

export interface IBoardRepository {
  findById(id: string): Promise<Board | null>;
  create(data: Prisma.BoardCreateInput): Promise<Board>;
  update(id: string, data: Prisma.BoardUpdateInput): Promise<Board>;
  delete(id: string): Promise<Board>;
  findByProject(projectId: string): Promise<BoardWithLists[]>;
  findByIdWithTaskLists(id: string): Promise<BoardWithListCounts | null>;
  createTaskList(data: Prisma.TaskListCreateInput): Promise<TaskList>;
  updateTaskList(id: string, data: Prisma.TaskListUpdateInput): Promise<TaskList>;
  deleteTaskList(id: string): Promise<TaskList>;
  findTaskList(id: string): Promise<TaskList | null>;
  resolveTaskListPath(taskListId: string): Promise<ResolvedTaskListPath | null>;
}

export class BoardRepository extends BaseRepository implements IBoardRepository {
  findById(id: string): Promise<Board | null> {
    return this.prisma.board.findUnique({ where: { id } });
  }

  create(data: Prisma.BoardCreateInput): Promise<Board> {
    return this.prisma.board.create({ data });
  }

  update(id: string, data: Prisma.BoardUpdateInput): Promise<Board> {
    return this.prisma.board.update({ where: { id }, data });
  }

  delete(id: string): Promise<Board> {
    return this.prisma.board.delete({ where: { id } });
  }

  findByProject(projectId: string): Promise<BoardWithLists[]> {
    return this.prisma.board.findMany({
      where: { projectId },
      ...boardWithTaskListsAndTasksArgs,
      orderBy: { position: 'asc' },
    });
  }

  findByIdWithTaskLists(id: string): Promise<BoardWithListCounts | null> {
    return this.prisma.board.findUnique({ where: { id }, ...boardWithTaskListCountsArgs });
  }

  createTaskList(data: Prisma.TaskListCreateInput): Promise<TaskList> {
    return this.prisma.taskList.create({ data });
  }

  updateTaskList(id: string, data: Prisma.TaskListUpdateInput): Promise<TaskList> {
    return this.prisma.taskList.update({ where: { id }, data });
  }

  deleteTaskList(id: string): Promise<TaskList> {
    return this.prisma.taskList.delete({ where: { id } });
  }

  findTaskList(id: string): Promise<TaskList | null> {
    return this.prisma.taskList.findUnique({ where: { id } });
  }

  // Walks taskList -> board -> project -> workspace to build the path SSE clients
  // key their query-cache invalidation on (see useRealtime.ts / taskKeys.board()).
  async resolveTaskListPath(taskListId: string): Promise<ResolvedTaskListPath | null> {
    const taskList = await this.prisma.taskList.findUnique({
      where: { id: taskListId },
      include: { board: { include: { project: { include: { workspace: true } } } } },
    });
    if (!taskList) return null;
    return {
      workspaceSlug: taskList.board.project.workspace.slug,
      projectId: taskList.board.projectId,
      boardId: taskList.boardId,
    };
  }
}
