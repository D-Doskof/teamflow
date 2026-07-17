import { Request, Response } from 'express';
import { IBoardService } from '../services/board.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';

export class BoardController {
  constructor(private readonly boardService: IBoardService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const board = await this.boardService.create(req.params.projectId, req.body, req.user!.id);
    sendCreated(res, board, 'Board created');
  };

  findByProject = async (req: Request, res: Response): Promise<void> => {
    const boards = await this.boardService.findByProject(req.params.projectId);
    sendSuccess(res, boards);
  };

  findOne = async (req: Request, res: Response): Promise<void> => {
    const board = await this.boardService.findById(req.params.boardId);
    sendSuccess(res, board);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const board = await this.boardService.update(req.params.boardId, req.body);
    sendSuccess(res, board, 'Board updated');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.boardService.delete(req.params.boardId);
    sendNoContent(res);
  };

  createTaskList = async (req: Request, res: Response): Promise<void> => {
    const taskList = await this.boardService.createTaskList(req.params.boardId, req.body);
    sendCreated(res, taskList, 'Task list created');
  };

  updateTaskList = async (req: Request, res: Response): Promise<void> => {
    const taskList = await this.boardService.updateTaskList(req.params.taskListId, req.body);
    sendSuccess(res, taskList, 'Task list updated');
  };

  deleteTaskList = async (req: Request, res: Response): Promise<void> => {
    await this.boardService.deleteTaskList(req.params.taskListId);
    sendNoContent(res);
  };
}
