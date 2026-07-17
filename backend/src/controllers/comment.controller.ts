import { Request, Response } from 'express';
import { ICommentService } from '../services/comment.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';

export class CommentController {
  constructor(private readonly commentService: ICommentService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const comment = await this.commentService.create(req.params.taskId, req.user!.id, req.body);
    sendCreated(res, comment, 'Comment added');
  };

  findByTask = async (req: Request, res: Response): Promise<void> => {
    const comments = await this.commentService.findByTask(req.params.taskId);
    sendSuccess(res, comments);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const comment = await this.commentService.update(req.params.commentId, req.user!.id, req.body);
    sendSuccess(res, comment, 'Comment updated');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.commentService.delete(req.params.commentId, req.user!.id);
    sendNoContent(res);
  };
}
