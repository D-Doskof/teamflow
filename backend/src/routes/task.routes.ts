import { Router } from 'express';
import { taskController, requireProjectRole } from '../container';
import { validate } from '../middlewares/validate.middleware';
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from '../validators/task.validator';
import { commentRouter } from './comment.routes';
import { subtaskRouter } from './subtask.routes';

export const taskRouter = Router({ mergeParams: true });

const canEdit = requireProjectRole('MEMBER', 'ADMIN', 'OWNER');
const canDelete = requireProjectRole('ADMIN', 'OWNER');

taskRouter.get('/', validate(taskFilterSchema, 'query'), taskController.findByBoard);
taskRouter.post('/list/:taskListId', canEdit, validate(createTaskSchema), taskController.create);

taskRouter.get('/:taskId', taskController.findOne);
taskRouter.patch('/:taskId', canEdit, validate(updateTaskSchema), taskController.update);
taskRouter.delete('/:taskId', canDelete, taskController.delete);

// Assignees — body-based (matches frontend)
taskRouter.post('/:taskId/assignees', canEdit, taskController.assignUser);
taskRouter.delete('/:taskId/assignees/:userId', canEdit, taskController.unassignUser);

// Labels
taskRouter.post('/:taskId/labels/:labelId', canEdit, taskController.addLabel);
taskRouter.delete('/:taskId/labels/:labelId', canEdit, taskController.removeLabel);

// Attachments (base64 JSON upload)
taskRouter.get('/:taskId/attachments', taskController.listAttachments);
taskRouter.post('/:taskId/attachments', canEdit, taskController.uploadAttachment);
taskRouter.get('/:taskId/attachments/:attachmentId', taskController.getAttachment);
taskRouter.delete('/:taskId/attachments/:attachmentId', canEdit, taskController.deleteAttachment);

// Activity
taskRouter.get('/:taskId/activity', taskController.getActivity);

// Subtasks
taskRouter.use('/:taskId/subtasks', subtaskRouter);

// Comments
taskRouter.use('/:taskId/comments', commentRouter);
