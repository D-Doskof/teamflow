import { Router } from 'express';
import { commentController } from '../container';
import { validate } from '../middlewares/validate.middleware';
import { createCommentSchema, updateCommentSchema } from '../validators/comment.validator';

export const commentRouter = Router({ mergeParams: true });

commentRouter.get('/', commentController.findByTask);
commentRouter.post('/', validate(createCommentSchema), commentController.create);
commentRouter.patch('/:commentId', validate(updateCommentSchema), commentController.update);
commentRouter.delete('/:commentId', commentController.delete);
