import { Subtask } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

export interface ISubtaskRepository {
  findByTask(taskId: string): Promise<Subtask[]>;
  findById(id: string): Promise<Subtask | null>;
  create(taskId: string, title: string): Promise<Subtask>;
  update(id: string, data: { title?: string; completed?: boolean }): Promise<Subtask>;
  delete(id: string): Promise<Subtask>;
}

export class SubtaskRepository extends BaseRepository implements ISubtaskRepository {
  findByTask(taskId: string): Promise<Subtask[]> {
    return this.prisma.subtask.findMany({
      where: { taskId },
      // createdAt tiebreaker: create()'s count-then-create can hand two subtasks the same
      // position, so this keeps ordering deterministic.
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findById(id: string): Promise<Subtask | null> {
    return this.prisma.subtask.findUnique({ where: { id } });
  }

  async create(taskId: string, title: string): Promise<Subtask> {
    const count = await this.prisma.subtask.count({ where: { taskId } });
    return this.prisma.subtask.create({ data: { taskId, title, position: count } });
  }

  update(id: string, data: { title?: string; completed?: boolean }): Promise<Subtask> {
    return this.prisma.subtask.update({ where: { id }, data });
  }

  delete(id: string): Promise<Subtask> {
    return this.prisma.subtask.delete({ where: { id } });
  }
}
