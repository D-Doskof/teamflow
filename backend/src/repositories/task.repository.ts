import {
  Attachment,
  Prisma,
  Priority,
  Task,
  TaskAssignee,
  TaskLabel,
  TaskStatus,
} from '@prisma/client';
import { TaskFilterQuery } from '../types';
import { getPaginationParams } from '../utils/pagination.util';
import { BaseRepository } from './BaseRepository';

const taskWithDetailsArgs = Prisma.validator<Prisma.TaskDefaultArgs>()({
  include: {
    taskList: { include: { board: { include: { project: true } } } },
    assignees: {
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    },
    labels: { include: { label: true } },
    attachments: true,
    comments: {
      include: { author: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    },
    activities: {
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    },
  },
});
export type TaskWithDetails = Prisma.TaskGetPayload<typeof taskWithDetailsArgs>;

const taskWithSummaryArgs = Prisma.validator<Prisma.TaskDefaultArgs>()({
  include: {
    assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
    labels: { include: { label: true } },
    _count: { select: { comments: true, attachments: true, subtasks: true } },
  },
});
export type TaskWithSummary = Prisma.TaskGetPayload<typeof taskWithSummaryArgs>;

const activityWithUserArgs = Prisma.validator<Prisma.ActivityDefaultArgs>()({
  include: { user: { select: { id: true, name: true, avatar: true } } },
});
export type ActivityWithUser = Prisma.ActivityGetPayload<typeof activityWithUserArgs>;

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByIdWithDetails(id: string): Promise<TaskWithDetails | null>;
  create(data: Prisma.TaskCreateInput): Promise<Task>;
  update(id: string, data: Prisma.TaskUpdateInput): Promise<Task>;
  delete(id: string): Promise<Task>;
  findWithFilters(
    taskListIds: string[],
    filters: TaskFilterQuery,
  ): Promise<{ tasks: TaskWithSummary[]; total: number; page: number; limit: number }>;
  addAssignee(taskId: string, userId: string): Promise<TaskAssignee>;
  removeAssignee(taskId: string, userId: string): Promise<TaskAssignee>;
  addLabel(taskId: string, labelId: string): Promise<TaskLabel>;
  removeLabel(taskId: string, labelId: string): Promise<TaskLabel>;
  createAttachment(data: {
    taskId: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    uploadedBy?: string;
  }): Promise<Attachment>;
  findAttachments(taskId: string): Promise<Attachment[]>;
  deleteAttachment(id: string): Promise<Attachment>;
  findAttachment(id: string): Promise<Attachment | null>;
  findActivity(taskId: string): Promise<ActivityWithUser[]>;
}

export class TaskRepository extends BaseRepository implements ITaskRepository {
  findById(id: string): Promise<Task | null> {
    return this.prisma.task.findUnique({ where: { id } });
  }

  findByIdWithDetails(id: string): Promise<TaskWithDetails | null> {
    return this.prisma.task.findUnique({ where: { id }, ...taskWithDetailsArgs });
  }

  create(data: Prisma.TaskCreateInput): Promise<Task> {
    return this.prisma.task.create({ data });
  }

  update(id: string, data: Prisma.TaskUpdateInput): Promise<Task> {
    return this.prisma.task.update({ where: { id }, data });
  }

  delete(id: string): Promise<Task> {
    return this.prisma.task.delete({ where: { id } });
  }

  async findWithFilters(taskListIds: string[], filters: TaskFilterQuery) {
    const { skip, take, page, limit } = getPaginationParams(filters);

    const where: Prisma.TaskWhereInput = {
      taskListId: { in: taskListIds },
      ...(filters.status ? { status: filters.status as TaskStatus } : {}),
      ...(filters.priority ? { priority: filters.priority as Priority } : {}),
      ...(filters.assigneeId ? { assignees: { some: { userId: filters.assigneeId } } } : {}),
      ...(filters.labelId ? { labels: { some: { labelId: filters.labelId } } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filters.dueDateFrom || filters.dueDateTo
        ? {
            dueDate: {
              ...(filters.dueDateFrom ? { gte: new Date(filters.dueDateFrom) } : {}),
              ...(filters.dueDateTo ? { lte: new Date(filters.dueDateTo) } : {}),
            },
          }
        : {}),
    };

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        ...taskWithSummaryArgs,
        orderBy: [{ taskListId: 'asc' }, { position: 'asc' }],
        skip,
        take,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, total, page, limit };
  }

  addAssignee(taskId: string, userId: string): Promise<TaskAssignee> {
    return this.prisma.taskAssignee.create({ data: { taskId, userId } });
  }

  removeAssignee(taskId: string, userId: string): Promise<TaskAssignee> {
    return this.prisma.taskAssignee.delete({ where: { taskId_userId: { taskId, userId } } });
  }

  addLabel(taskId: string, labelId: string): Promise<TaskLabel> {
    return this.prisma.taskLabel.create({ data: { taskId, labelId } });
  }

  removeLabel(taskId: string, labelId: string): Promise<TaskLabel> {
    return this.prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } });
  }

  createAttachment(data: {
    taskId: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    uploadedBy?: string;
  }): Promise<Attachment> {
    return this.prisma.attachment.create({ data });
  }

  findAttachments(taskId: string): Promise<Attachment[]> {
    return this.prisma.attachment.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' } });
  }

  deleteAttachment(id: string): Promise<Attachment> {
    return this.prisma.attachment.delete({ where: { id } });
  }

  findAttachment(id: string): Promise<Attachment | null> {
    return this.prisma.attachment.findUnique({ where: { id } });
  }

  findActivity(taskId: string): Promise<ActivityWithUser[]> {
    return this.prisma.activity.findMany({
      where: { taskId },
      ...activityWithUserArgs,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
