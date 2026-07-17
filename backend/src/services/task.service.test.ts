import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Priority, TaskStatus } from '@prisma/client';
import { TaskService } from './task.service';
import { ITaskRepository } from '../repositories/task.repository';
import { IBoardRepository } from '../repositories/board.repository';
import { IActivityRepository } from '../repositories/activity.repository';
import { INotificationService } from './notification.service';
import { IUploadService } from './upload.service';
import { IEventBroadcaster } from '../realtime/EventBroadcaster';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task_1',
    taskListId: 'list_1',
    title: 'Ship the feature',
    description: null,
    priority: Priority.NONE,
    status: TaskStatus.TODO,
    position: 0,
    dueDate: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as never;
}

let taskRepository: MockProxy<ITaskRepository>;
let boardRepository: MockProxy<IBoardRepository>;
let activityRepository: MockProxy<IActivityRepository>;
let notificationService: MockProxy<INotificationService>;
let uploadService: MockProxy<IUploadService>;
let eventBroadcaster: MockProxy<IEventBroadcaster>;
let taskService: TaskService;

beforeEach(() => {
  taskRepository = mock<ITaskRepository>();
  boardRepository = mock<IBoardRepository>();
  activityRepository = mock<IActivityRepository>();
  notificationService = mock<INotificationService>();
  uploadService = mock<IUploadService>();
  eventBroadcaster = mock<IEventBroadcaster>();
  taskService = new TaskService({
    taskRepository,
    boardRepository,
    activityRepository,
    notificationService,
    uploadService,
    eventBroadcaster,
  });

  boardRepository.resolveTaskListPath.mockResolvedValue({
    workspaceSlug: 'acme',
    projectId: 'proj_1',
    boardId: 'board_1',
  });
  taskRepository.findByIdWithDetails.mockResolvedValue(makeTask());
  activityRepository.create.mockResolvedValue({} as never);
});

describe('taskService.create', () => {
  it('rejects when the target task list does not exist', async () => {
    boardRepository.findTaskList.mockResolvedValue(null);

    await expect(
      taskService.create('missing-list', 'user_1', { title: 'x' } as never),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(taskRepository.create).not.toHaveBeenCalled();
  });

  it('adds all assignees and labels in parallel, tolerating individual failures', async () => {
    boardRepository.findTaskList.mockResolvedValue({ id: 'list_1' } as never);
    taskRepository.create.mockResolvedValue(makeTask());
    taskRepository.addAssignee
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('duplicate assignee')); // must not abort the request
    taskRepository.addLabel.mockResolvedValue({} as never);

    await taskService.create('list_1', 'user_1', {
      title: 'Ship the feature',
      assigneeIds: ['user_a', 'user_b'],
      labelIds: ['label_1'],
    } as never);

    expect(taskRepository.addAssignee).toHaveBeenCalledTimes(2);
    expect(taskRepository.addAssignee).toHaveBeenCalledWith('task_1', 'user_a');
    expect(taskRepository.addAssignee).toHaveBeenCalledWith('task_1', 'user_b');
    expect(taskRepository.addLabel).toHaveBeenCalledWith('task_1', 'label_1');
  });

  it('broadcasts a board:change event scoped to the resolved board path', async () => {
    boardRepository.findTaskList.mockResolvedValue({ id: 'list_1' } as never);
    taskRepository.create.mockResolvedValue(makeTask());

    await taskService.create('list_1', 'user_1', { title: 'Ship the feature' } as never);

    expect(eventBroadcaster.broadcast).toHaveBeenCalledWith('board:change', {
      workspaceSlug: 'acme',
      projectId: 'proj_1',
      boardId: 'board_1',
      taskId: 'task_1',
    });
  });

  it('does not let a broadcast failure fail the request — realtime is best-effort', async () => {
    boardRepository.findTaskList.mockResolvedValue({ id: 'list_1' } as never);
    taskRepository.create.mockResolvedValue(makeTask());
    boardRepository.resolveTaskListPath.mockRejectedValue(new Error('db hiccup'));

    await expect(
      taskService.create('list_1', 'user_1', { title: 'Ship the feature' } as never),
    ).resolves.toBeDefined();
  });
});

describe('taskService.update', () => {
  it('only logs a STATUS_CHANGED activity when the status actually changes', async () => {
    taskRepository.findById.mockResolvedValue(makeTask({ status: TaskStatus.TODO }));
    taskRepository.update.mockResolvedValue(makeTask({ status: TaskStatus.TODO }));

    await taskService.update('task_1', 'user_1', { status: TaskStatus.TODO } as never);

    expect(activityRepository.create).not.toHaveBeenCalled();
  });

  it('logs a STATUS_CHANGED activity when the status actually changes', async () => {
    taskRepository.findById.mockResolvedValue(makeTask({ status: TaskStatus.TODO }));
    taskRepository.update.mockResolvedValue(makeTask({ status: TaskStatus.DONE }));

    await taskService.update('task_1', 'user_1', { status: TaskStatus.DONE } as never);

    expect(activityRepository.create).toHaveBeenCalledWith('task_1', 'user_1', 'STATUS_CHANGED', {
      from: TaskStatus.TODO,
      to: TaskStatus.DONE,
    });
  });

  it('rejects updating a task that does not exist', async () => {
    taskRepository.findById.mockResolvedValue(null);

    await expect(taskService.update('missing', 'user_1', {} as never)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('taskService.delete', () => {
  it('rejects deleting a task that does not exist', async () => {
    taskRepository.findById.mockResolvedValue(null);

    await expect(taskService.delete('missing')).rejects.toMatchObject({ statusCode: 404 });
    expect(taskRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes the task and broadcasts a board:change with a null taskId', async () => {
    taskRepository.findById.mockResolvedValue(makeTask());
    taskRepository.delete.mockResolvedValue({} as never);

    await taskService.delete('task_1');

    expect(taskRepository.delete).toHaveBeenCalledWith('task_1');
    expect(eventBroadcaster.broadcast).toHaveBeenCalledWith('board:change', {
      workspaceSlug: 'acme',
      projectId: 'proj_1',
      boardId: 'board_1',
      taskId: null,
    });
  });
});

// Regression coverage for the 2026-07-02 fix: deleteAttachment used to accept a `userId` param
// it never checked, so any authenticated task-list member could delete anyone else's attachment.
describe('taskService.deleteAttachment', () => {
  it('rejects deleting an attachment you did not upload', async () => {
    taskRepository.findAttachment.mockResolvedValue({
      id: 'att_1',
      taskId: 'task_1',
      name: 'file.png',
      url: 'http://x/uploads/file.png',
      mimeType: 'image/png',
      size: 100,
      uploadedBy: 'other-user',
      createdAt: new Date(),
    } as never);

    await expect(taskService.deleteAttachment('att_1', 'user_1')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(taskRepository.deleteAttachment).not.toHaveBeenCalled();
    expect(uploadService.deleteFile).not.toHaveBeenCalled();
  });

  it('allows the uploader to delete their own attachment and cleans up the file on disk', async () => {
    taskRepository.findAttachment.mockResolvedValue({
      id: 'att_1',
      taskId: 'task_1',
      name: 'file.png',
      url: 'http://x/uploads/file.png',
      mimeType: 'image/png',
      size: 100,
      uploadedBy: 'user_1',
      createdAt: new Date(),
    } as never);
    taskRepository.deleteAttachment.mockResolvedValue({} as never);
    uploadService.extractFilename.mockReturnValue('file.png');
    uploadService.deleteFile.mockResolvedValue(undefined);

    await taskService.deleteAttachment('att_1', 'user_1');

    expect(taskRepository.deleteAttachment).toHaveBeenCalledWith('att_1');
    expect(uploadService.deleteFile).toHaveBeenCalledWith('file.png');
  });

  it('rejects deleting an attachment that does not exist', async () => {
    taskRepository.findAttachment.mockResolvedValue(null);

    await expect(taskService.deleteAttachment('missing', 'user_1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
