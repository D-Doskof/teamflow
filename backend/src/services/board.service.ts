import { IBoardRepository } from '../repositories/board.repository';
import { IProjectRepository } from '../repositories/project.repository';
import { IUserRepository } from '../repositories/user.repository';
import { NotFoundError } from '../utils/error.util';
import { resolveLocale, SupportedLocale } from '../utils/locale.util';
import {
  CreateBoardDto,
  UpdateBoardDto,
  CreateTaskListDto,
  UpdateTaskListDto,
} from '../validators/board.validator';

export interface IBoardService {
  create(
    projectId: string,
    dto: CreateBoardDto,
    userId: string,
  ): ReturnType<IBoardRepository['create']>;
  findByProject(projectId: string): ReturnType<IBoardRepository['findByProject']>;
  findById(boardId: string): ReturnType<IBoardRepository['findByIdWithTaskLists']>;
  update(boardId: string, dto: UpdateBoardDto): ReturnType<IBoardRepository['update']>;
  delete(boardId: string): ReturnType<IBoardRepository['delete']>;
  createTaskList(
    boardId: string,
    dto: CreateTaskListDto,
  ): ReturnType<IBoardRepository['createTaskList']>;
  updateTaskList(
    taskListId: string,
    dto: UpdateTaskListDto,
  ): ReturnType<IBoardRepository['updateTaskList']>;
  deleteTaskList(taskListId: string): ReturnType<IBoardRepository['deleteTaskList']>;
}

// Seeded on every new board so it isn't an empty shell. Names must match the substrings
// KanbanBoard's inferStatus() keys off of (frontend), so cards get the right TaskStatus
// automatically. Keyed by the creating user's locale.
const DEFAULT_TASK_LISTS: Record<SupportedLocale, { name: string; position: number }[]> = {
  en: [
    { name: 'To Do', position: 0 },
    { name: 'In Progress', position: 1 },
    { name: 'Done', position: 2 },
  ],
  ru: [
    { name: 'Сделать', position: 0 },
    { name: 'В работе', position: 1 },
    { name: 'Готово', position: 2 },
  ],
  pl: [
    { name: 'Do zrobienia', position: 0 },
    { name: 'W trakcie', position: 1 },
    { name: 'Zrobione', position: 2 },
  ],
};

export class BoardService implements IBoardService {
  constructor(
    private readonly boardRepository: IBoardRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async create(projectId: string, dto: CreateBoardDto, userId: string) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError('Project');

    const user = await this.userRepository.findById(userId);
    const locale = resolveLocale(user?.locale);

    return this.boardRepository.create({
      name: dto.name,
      description: dto.description,
      project: { connect: { id: projectId } },
      taskLists: { create: DEFAULT_TASK_LISTS[locale] },
    });
  }

  findByProject(projectId: string) {
    return this.boardRepository.findByProject(projectId);
  }

  async findById(boardId: string) {
    const board = await this.boardRepository.findByIdWithTaskLists(boardId);
    if (!board) throw new NotFoundError('Board');
    return board;
  }

  async update(boardId: string, dto: UpdateBoardDto) {
    const board = await this.boardRepository.findById(boardId);
    if (!board) throw new NotFoundError('Board');
    return this.boardRepository.update(boardId, dto);
  }

  async delete(boardId: string) {
    const board = await this.boardRepository.findById(boardId);
    if (!board) throw new NotFoundError('Board');
    return this.boardRepository.delete(boardId);
  }

  async createTaskList(boardId: string, dto: CreateTaskListDto) {
    const board = await this.boardRepository.findByIdWithTaskLists(boardId);
    if (!board) throw new NotFoundError('Board');

    // max()+1 rather than taskLists.length, so a gap left by a deleted column can't
    // cause a position collision.
    const nextPosition = board.taskLists.length
      ? Math.max(...board.taskLists.map((l) => l.position)) + 1
      : 0;

    return this.boardRepository.createTaskList({
      name: dto.name,
      color: dto.color,
      position: dto.position ?? nextPosition,
      board: { connect: { id: boardId } },
    });
  }

  async updateTaskList(taskListId: string, dto: UpdateTaskListDto) {
    const taskList = await this.boardRepository.findTaskList(taskListId);
    if (!taskList) throw new NotFoundError('Task list');
    return this.boardRepository.updateTaskList(taskListId, dto);
  }

  async deleteTaskList(taskListId: string) {
    const taskList = await this.boardRepository.findTaskList(taskListId);
    if (!taskList) throw new NotFoundError('Task list');
    return this.boardRepository.deleteTaskList(taskListId);
  }
}
