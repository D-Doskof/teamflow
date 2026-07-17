import { ISubtaskRepository } from '../repositories/subtask.repository';
import { ITaskRepository } from '../repositories/task.repository';
import { NotFoundError } from '../utils/error.util';

export interface ISubtaskService {
  findByTask(taskId: string): ReturnType<ISubtaskRepository['findByTask']>;
  create(taskId: string, title: string): ReturnType<ISubtaskRepository['create']>;
  update(
    subtaskId: string,
    data: { title?: string; completed?: boolean },
  ): ReturnType<ISubtaskRepository['update']>;
  delete(subtaskId: string): ReturnType<ISubtaskRepository['delete']>;
}

export class SubtaskService implements ISubtaskService {
  constructor(
    private readonly subtaskRepository: ISubtaskRepository,
    private readonly taskRepository: ITaskRepository,
  ) {}

  async findByTask(taskId: string) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');
    return this.subtaskRepository.findByTask(taskId);
  }

  async create(taskId: string, title: string) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');
    return this.subtaskRepository.create(taskId, title.trim());
  }

  async update(subtaskId: string, data: { title?: string; completed?: boolean }) {
    const subtask = await this.subtaskRepository.findById(subtaskId);
    if (!subtask) throw new NotFoundError('Subtask');
    return this.subtaskRepository.update(subtaskId, data);
  }

  async delete(subtaskId: string) {
    const subtask = await this.subtaskRepository.findById(subtaskId);
    if (!subtask) throw new NotFoundError('Subtask');
    return this.subtaskRepository.delete(subtaskId);
  }
}
