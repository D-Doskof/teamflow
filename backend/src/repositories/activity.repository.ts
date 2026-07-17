import { Activity, ActivityType, Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

export interface IActivityRepository {
  create(
    taskId: string,
    userId: string,
    type: ActivityType,
    data?: Record<string, unknown>,
  ): Promise<Activity>;
}

export class ActivityRepository extends BaseRepository implements IActivityRepository {
  create(
    taskId: string,
    userId: string,
    type: ActivityType,
    data?: Record<string, unknown>,
  ): Promise<Activity> {
    return this.prisma.activity.create({
      data: { taskId, userId, type, data: data as Prisma.InputJsonValue | undefined },
    });
  }
}
