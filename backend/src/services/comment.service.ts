import { ActivityType } from '@prisma/client';
import { ICommentRepository } from '../repositories/comment.repository';
import { ITaskRepository } from '../repositories/task.repository';
import { IActivityRepository } from '../repositories/activity.repository';
import { ForbiddenError, NotFoundError } from '../utils/error.util';
import { CreateCommentDto, UpdateCommentDto } from '../validators/comment.validator';

export interface ICommentService {
  create(
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): ReturnType<ICommentRepository['create']>;
  update(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ): ReturnType<ICommentRepository['update']>;
  delete(commentId: string, userId: string): ReturnType<ICommentRepository['delete']>;
  findByTask(taskId: string): ReturnType<ICommentRepository['findByTask']>;
}

export class CommentService implements ICommentService {
  constructor(
    private readonly commentRepository: ICommentRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly activityRepository: IActivityRepository,
  ) {}

  async create(taskId: string, authorId: string, dto: CreateCommentDto) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task');

    const comment = await this.commentRepository.create(taskId, authorId, dto.content);

    await this.activityRepository.create(taskId, authorId, ActivityType.COMMENT_ADDED, {
      commentId: comment.id,
    });

    return comment;
  }

  async update(commentId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new NotFoundError('Comment');

    if (comment.authorId !== userId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    return this.commentRepository.update(commentId, dto.content);
  }

  async delete(commentId: string, userId: string) {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) throw new NotFoundError('Comment');

    if (comment.authorId !== userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    return this.commentRepository.delete(commentId);
  }

  findByTask(taskId: string) {
    return this.commentRepository.findByTask(taskId);
  }
}
