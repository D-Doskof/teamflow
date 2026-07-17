import { ActivityType, Attachment } from '@prisma/client';
import { ITaskRepository } from '../repositories/task.repository';
import { IBoardRepository } from '../repositories/board.repository';
import { IActivityRepository } from '../repositories/activity.repository';
import { INotificationService } from './notification.service';
import { NotFoundError, ForbiddenError } from '../utils/error.util';
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto } from '../validators/task.validator';
import { buildPaginationMeta } from '../utils/pagination.util';
import { TaskFilterQuery } from '../types';
import { IEventBroadcaster } from '../realtime/EventBroadcaster';
import { IUploadService } from './upload.service';

export interface ITaskService {
  create(
    taskListId: string,
    userId: string,
    dto: CreateTaskDto,
  ): ReturnType<ITaskRepository['findByIdWithDetails']>;
  findById(taskId: string): ReturnType<ITaskRepository['findByIdWithDetails']>;
  findByBoard(
    boardId: string,
    filters: TaskFilterDto,
  ): Promise<{ tasks: unknown[]; meta: ReturnType<typeof buildPaginationMeta> }>;
  update(
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ): ReturnType<ITaskRepository['findByIdWithDetails']>;
  delete(taskId: string): Promise<void>;
  assignUser(
    taskId: string,
    userId: string,
    requesterId: string,
  ): ReturnType<ITaskRepository['findByIdWithDetails']>;
  unassignUser(
    taskId: string,
    userId: string,
    requesterId: string,
  ): ReturnType<ITaskRepository['findByIdWithDetails']>;
  addLabel(
    taskId: string,
    labelId: string,
    userId: string,
  ): ReturnType<ITaskRepository['findByIdWithDetails']>;
  removeLabel(
    taskId: string,
    labelId: string,
    userId: string,
  ): ReturnType<ITaskRepository['findByIdWithDetails']>;
  addAttachment(
    taskId: string,
    userId: string,
    file: { name: string; url: string; mimeType: string; size: number },
  ): ReturnType<ITaskRepository['createAttachment']>;
  listAttachments(taskId: string): ReturnType<ITaskRepository['findAttachments']>;
  getAttachment(attachmentId: string): Promise<Attachment>;
  deleteAttachment(
    attachmentId: string,
    userId: string,
  ): ReturnType<ITaskRepository['deleteAttachment']>;
  getActivity(taskId: string): Promise<unknown[]>;
}

// Deps-object constructor: six collaborators (three repositories, two services, the
// realtime broadcaster) — named fields keep container.ts wiring readable and typo-proof.
export interface TaskServiceDeps {
  taskRepository: ITaskRepository;
  boardRepository: IBoardRepository;
  activityRepository: IActivityRepository;
  notificationService: INotificationService;
  uploadService: IUploadService;
  eventBroadcaster: IEventBroadcaster;
}

const ACTION_MAP: Record<string, string> = {
  TASK_CREATED: 'created',
  TASK_UPDATED: 'updated',
  TASK_DELETED: 'deleted',
  TASK_ASSIGNED: 'added_assignee',
  TASK_UNASSIGNED: 'removed_assignee',
  COMMENT_ADDED: 'added_comment',
  ATTACHMENT_ADDED: 'added_attachment',
  STATUS_CHANGED: 'changed_status',
  PRIORITY_CHANGED: 'changed_priority',
  DUE_DATE_CHANGED: 'changed_due_date',
  LABEL_ADDED: 'added_label',
  LABEL_REMOVED: 'removed_label',
};

export class TaskService implements ITaskService {
  constructor(private readonly deps: TaskServiceDeps) {}

  // Non-critical: a client just misses a live update and stays on 20s polling until next change.
  private async notifyBoardChange(taskListId: string, taskId: string | null): Promise<void> {
    try {
      const path = await this.deps.boardRepository.resolveTaskListPath(taskListId);
      if (path) this.deps.eventBroadcaster.broadcast('board:change', { ...path, taskId });
    } catch (err) {
      console.error('[Realtime] Failed to broadcast board:change:', err);
    }
  }

  async create(taskListId: string, userId: string, dto: CreateTaskDto) {
    const { taskRepository, boardRepository, activityRepository } = this.deps;

    const taskList = await boardRepository.findTaskList(taskListId);
    if (!taskList) throw new NotFoundError('Task list');

    const task = await taskRepository.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      status: dto.status,
      position: dto.position ?? 0,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      taskList: { connect: { id: taskListId } },
    });

    await activityRepository.create(task.id, userId, ActivityType.TASK_CREATED);

    await Promise.all([
      ...(dto.assigneeIds?.map((assigneeId) =>
        taskRepository.addAssignee(task.id, assigneeId).catch(() => null),
      ) ?? []),
      ...(dto.labelIds?.map((labelId) =>
        taskRepository.addLabel(task.id, labelId).catch(() => null),
      ) ?? []),
    ]);

    await this.notifyBoardChange(taskListId, task.id);
    return taskRepository.findByIdWithDetails(task.id);
  }

  async findById(taskId: string) {
    const task = await this.deps.taskRepository.findByIdWithDetails(taskId);
    if (!task) throw new NotFoundError('Task');
    return task;
  }

  async findByBoard(boardId: string, filters: TaskFilterDto) {
    const { boardRepository, taskRepository } = this.deps;

    const board = await boardRepository.findByIdWithTaskLists(boardId);
    if (!board) throw new NotFoundError('Board');

    const taskListIds = board.taskLists.map((tl) => tl.id);
    const { tasks, total, page, limit } = await taskRepository.findWithFilters(
      taskListIds,
      filters as TaskFilterQuery,
    );

    return { tasks, meta: buildPaginationMeta(total, page, limit) };
  }

  async update(taskId: string, userId: string, dto: UpdateTaskDto) {
    const { taskRepository, activityRepository } = this.deps;

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    const activities: Promise<unknown>[] = [];

    if (dto.status && dto.status !== task.status) {
      activities.push(
        activityRepository.create(taskId, userId, ActivityType.STATUS_CHANGED, {
          from: task.status,
          to: dto.status,
        }),
      );
    }

    if (dto.priority && dto.priority !== task.priority) {
      activities.push(
        activityRepository.create(taskId, userId, ActivityType.PRIORITY_CHANGED, {
          from: task.priority,
          to: dto.priority,
        }),
      );
    }

    if (dto.dueDate !== undefined) {
      activities.push(
        activityRepository.create(taskId, userId, ActivityType.DUE_DATE_CHANGED, {
          from: task.dueDate,
          to: dto.dueDate,
        }),
      );
    }

    const updateData = {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : dto.dueDate === null ? null : undefined,
    };

    const [updated] = await Promise.all([taskRepository.update(taskId, updateData), ...activities]);

    await this.notifyBoardChange(updated.taskListId, updated.id);
    return taskRepository.findByIdWithDetails(updated.id);
  }

  async delete(taskId: string): Promise<void> {
    const { taskRepository } = this.deps;

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');
    await taskRepository.delete(taskId);
    await this.notifyBoardChange(task.taskListId, null);
  }

  async assignUser(taskId: string, userId: string, requesterId: string) {
    const { taskRepository, activityRepository, notificationService } = this.deps;

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    await taskRepository.addAssignee(taskId, userId);
    await activityRepository.create(taskId, requesterId, ActivityType.TASK_ASSIGNED, { userId });

    await notificationService.create(
      userId,
      'You have been assigned to a task',
      `You were assigned to "${task.title}"`,
      { taskId },
    );

    await this.notifyBoardChange(task.taskListId, taskId);
    return taskRepository.findByIdWithDetails(taskId);
  }

  async unassignUser(taskId: string, userId: string, requesterId: string) {
    const { taskRepository, activityRepository } = this.deps;

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    await taskRepository.removeAssignee(taskId, userId);
    await activityRepository.create(taskId, requesterId, ActivityType.TASK_UNASSIGNED, { userId });

    await this.notifyBoardChange(task.taskListId, taskId);
    return taskRepository.findByIdWithDetails(taskId);
  }

  async addLabel(taskId: string, labelId: string, userId: string) {
    const { taskRepository, activityRepository } = this.deps;

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    await taskRepository.addLabel(taskId, labelId);
    await activityRepository.create(taskId, userId, ActivityType.LABEL_ADDED, { labelId });

    await this.notifyBoardChange(task.taskListId, taskId);
    return taskRepository.findByIdWithDetails(taskId);
  }

  async removeLabel(taskId: string, labelId: string, userId: string) {
    const { taskRepository, activityRepository } = this.deps;

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    await taskRepository.removeLabel(taskId, labelId);
    await activityRepository.create(taskId, userId, ActivityType.LABEL_REMOVED, { labelId });

    await this.notifyBoardChange(task.taskListId, taskId);
    return taskRepository.findByIdWithDetails(taskId);
  }

  async addAttachment(
    taskId: string,
    userId: string,
    file: { name: string; url: string; mimeType: string; size: number },
  ) {
    const { taskRepository, activityRepository } = this.deps;

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    const attachment = await taskRepository.createAttachment({
      taskId,
      uploadedBy: userId,
      ...file,
    });
    await activityRepository.create(taskId, userId, ActivityType.ATTACHMENT_ADDED, {
      attachmentId: attachment.id,
    });

    return attachment;
  }

  async listAttachments(taskId: string) {
    const task = await this.deps.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');
    return this.deps.taskRepository.findAttachments(taskId);
  }

  async getAttachment(attachmentId: string) {
    const attachment = await this.deps.taskRepository.findAttachment(attachmentId);
    if (!attachment) throw new NotFoundError('Attachment');
    return attachment;
  }

  async deleteAttachment(attachmentId: string, userId: string) {
    const { taskRepository, uploadService } = this.deps;

    const attachment = await taskRepository.findAttachment(attachmentId);
    if (!attachment) throw new NotFoundError('Attachment');
    if (attachment.uploadedBy !== userId) {
      throw new ForbiddenError('You can only delete your own attachments');
    }
    const deleted = await taskRepository.deleteAttachment(attachmentId);
    // Best-effort cleanup of the file on disk — don't fail the request if this errors
    // (uploadService.deleteFile already swallows ENOENT etc. internally).
    void uploadService.deleteFile(uploadService.extractFilename(attachment.url));
    return deleted;
  }

  async getActivity(taskId: string) {
    const task = await this.deps.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');
    const activities = await this.deps.taskRepository.findActivity(taskId);

    return activities.map((a) => {
      const data = (a.data as Record<string, unknown>) ?? {};
      return {
        id: a.id,
        action: ACTION_MAP[a.type] ?? a.type.toLowerCase(),
        field: (data.field as string | null) ?? null,
        oldValue: (data.from as string | null) ?? null,
        newValue: (data.to as string | null) ?? null,
        createdAt: a.createdAt,
        user: a.user,
      };
    });
  }
}
