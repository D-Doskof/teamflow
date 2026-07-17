import { Prisma, Role, WorkspaceInvitation } from '@prisma/client';
import { BaseRepository } from './BaseRepository';

const invitationWithRelationsArgs = Prisma.validator<Prisma.WorkspaceInvitationDefaultArgs>()({
  include: {
    workspace: { select: { id: true, name: true, slug: true } },
    inviter: { select: { id: true, name: true } },
  },
});
export type InvitationWithRelations = Prisma.WorkspaceInvitationGetPayload<
  typeof invitationWithRelationsArgs
>;

export interface IInvitationRepository {
  create(
    workspaceId: string,
    email: string,
    role: Role,
    invitedBy: string,
  ): Promise<InvitationWithRelations>;
  findById(id: string): Promise<InvitationWithRelations | null>;
  findByWorkspace(workspaceId: string): Promise<InvitationWithRelations[]>;
  findPendingByEmail(email: string): Promise<InvitationWithRelations[]>;
  findExisting(workspaceId: string, email: string): Promise<WorkspaceInvitation | null>;
  findStatusesByIds(ids: string[]): Promise<Pick<WorkspaceInvitation, 'id' | 'status'>[]>;
  updateStatus(
    id: string,
    status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED',
  ): Promise<WorkspaceInvitation>;
  declineStale(): Promise<number>;
  delete(id: string): Promise<WorkspaceInvitation>;
}

export class InvitationRepository extends BaseRepository implements IInvitationRepository {
  create(
    workspaceId: string,
    email: string,
    role: Role,
    invitedBy: string,
  ): Promise<InvitationWithRelations> {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    return this.prisma.workspaceInvitation.create({
      data: { workspaceId, email, role, invitedBy, expiresAt },
      ...invitationWithRelationsArgs,
    });
  }

  findById(id: string): Promise<InvitationWithRelations | null> {
    return this.prisma.workspaceInvitation.findUnique({
      where: { id },
      ...invitationWithRelationsArgs,
    });
  }

  findByWorkspace(workspaceId: string): Promise<InvitationWithRelations[]> {
    return this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: 'PENDING' },
      ...invitationWithRelationsArgs,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendingByEmail(email: string): Promise<InvitationWithRelations[]> {
    return this.prisma.workspaceInvitation.findMany({
      where: { email, status: 'PENDING', expiresAt: { gt: new Date() } },
      ...invitationWithRelationsArgs,
      orderBy: { createdAt: 'desc' },
    });
  }

  findExisting(workspaceId: string, email: string) {
    return this.prisma.workspaceInvitation.findFirst({
      where: { workspaceId, email, status: 'PENDING' },
    });
  }

  findStatusesByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.workspaceInvitation.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
  }

  updateStatus(id: string, status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED') {
    return this.prisma.workspaceInvitation.update({ where: { id }, data: { status } });
  }

  async declineStale(): Promise<number> {
    const { count } = await this.prisma.workspaceInvitation.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'DECLINED' },
    });
    return count;
  }

  delete(id: string) {
    return this.prisma.workspaceInvitation.delete({ where: { id } });
  }
}
