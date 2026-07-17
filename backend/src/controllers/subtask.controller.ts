import { Request, Response } from 'express';
import { ISubtaskService } from '../services/subtask.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';

export class SubtaskController {
  constructor(private readonly subtaskService: ISubtaskService) {}

  findByTask = async (req: Request, res: Response): Promise<void> => {
    const subtasks = await this.subtaskService.findByTask(req.params.taskId);
    sendSuccess(res, subtasks);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const subtask = await this.subtaskService.create(req.params.taskId, req.body.title);
    sendCreated(res, subtask, 'Subtask created');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const subtask = await this.subtaskService.update(req.params.subtaskId, req.body);
    sendSuccess(res, subtask, 'Subtask updated');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.subtaskService.delete(req.params.subtaskId);
    sendNoContent(res);
  };
}
