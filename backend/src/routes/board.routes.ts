import { Router } from 'express';
import { boardController, requireProjectRole } from '../container';
import { validate } from '../middlewares/validate.middleware';
import {
  createBoardSchema,
  updateBoardSchema,
  createTaskListSchema,
  updateTaskListSchema,
} from '../validators/board.validator';
import { taskRouter } from './task.routes';

export const boardRouter = Router({ mergeParams: true });

const canEdit = requireProjectRole('MEMBER', 'ADMIN', 'OWNER');
const canDelete = requireProjectRole('ADMIN', 'OWNER');

boardRouter.get('/', boardController.findByProject);
boardRouter.post('/', canEdit, validate(createBoardSchema), boardController.create);

boardRouter.get('/:boardId', boardController.findOne);
boardRouter.patch('/:boardId', canEdit, validate(updateBoardSchema), boardController.update);
boardRouter.delete('/:boardId', canDelete, boardController.delete);

boardRouter.post(
  '/:boardId/lists',
  canEdit,
  validate(createTaskListSchema),
  boardController.createTaskList,
);
boardRouter.patch(
  '/:boardId/lists/:taskListId',
  canEdit,
  validate(updateTaskListSchema),
  boardController.updateTaskList,
);
boardRouter.delete('/:boardId/lists/:taskListId', canDelete, boardController.deleteTaskList);

boardRouter.use('/:boardId/tasks', taskRouter);
