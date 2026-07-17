import { Comment, Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

const commentWithAuthorArgs = Prisma.validator<Prisma.CommentDefaultArgs>()({
  include: { author: { select: { id: true, name: true, avatar: true } } },
});
export type CommentWithAuthor = Prisma.CommentGetPayload<typeof commentWithAuthorArgs>;

export interface ICommentRepository {
  findById(id: string): Promise<CommentWithAuthor | null>;
  create(taskId: string, authorId: string, content: string): Promise<CommentWithAuthor>;
  update(id: string, content: string): Promise<CommentWithAuthor>;
  delete(id: string): Promise<Comment>;
  findByTask(taskId: string): Promise<CommentWithAuthor[]>;
}

export class CommentRepository extends BaseRepository implements ICommentRepository {
  findById(id: string): Promise<CommentWithAuthor | null> {
    return this.prisma.comment.findUnique({ where: { id }, ...commentWithAuthorArgs });
  }

  create(taskId: string, authorId: string, content: string): Promise<CommentWithAuthor> {
    return this.prisma.comment.create({
      data: { taskId, authorId, content },
      ...commentWithAuthorArgs,
    });
  }

  update(id: string, content: string): Promise<CommentWithAuthor> {
    return this.prisma.comment.update({
      where: { id },
      data: { content },
      ...commentWithAuthorArgs,
    });
  }

  delete(id: string): Promise<Comment> {
    return this.prisma.comment.delete({ where: { id } });
  }

  findByTask(taskId: string): Promise<CommentWithAuthor[]> {
    return this.prisma.comment.findMany({
      where: { taskId },
      ...commentWithAuthorArgs,
      orderBy: { createdAt: 'asc' },
    });
  }
}
