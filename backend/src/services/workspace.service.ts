import { Role } from '@prisma/client';
import { IWorkspaceRepository } from '../repositories/workspace.repository';
import { IUserRepository } from '../repositories/user.repository';
import { generateSlug } from '../utils/slug.util';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/error.util';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from '../validators/workspace.validator';
import { MemberPermissions } from '../types';

function computePermissions(
  role: Role,
  custom?: Record<string, boolean> | null,
): MemberPermissions {
  const base: MemberPermissions = {
    canEditContent: role !== 'VIEWER',
    canDeleteContent: role === 'OWNER' || role === 'ADMIN',
    canManageMembers: role === 'OWNER' || role === 'ADMIN',
    canManageAdmins: role === 'OWNER',
    canComment: true,
  };
  if (!custom) return base;
  return { ...base, ...custom };
}

export interface IWorkspaceService {
  create(userId: string, dto: CreateWorkspaceDto): ReturnType<IWorkspaceRepository['create']>;
  findUserWorkspaces(userId: string): ReturnType<IWorkspaceRepository['findUserWorkspaces']>;
  findBySlug(slug: string, userId: string): ReturnType<IWorkspaceRepository['findBySlug']>;
  update(workspaceId: string, dto: UpdateWorkspaceDto): ReturnType<IWorkspaceRepository['update']>;
  delete(workspaceId: string, userId: string): ReturnType<IWorkspaceRepository['delete']>;
  getMembers(
    workspaceId: string,
  ): Promise<
    Array<
      Awaited<ReturnType<IWorkspaceRepository['findMembers']>>[number] & {
        permissions: MemberPermissions;
      }
    >
  >;
  inviteMember(
    workspaceId: string,
    dto: InviteMemberDto,
  ): ReturnType<IWorkspaceRepository['addMember']>;
  updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    requestingUserId: string,
  ): ReturnType<IWorkspaceRepository['updateMemberRole']>;
  getMember(
    workspaceId: string,
    userId: string,
  ): Promise<
    Awaited<ReturnType<IWorkspaceRepository['findMember']>> & { permissions: MemberPermissions }
  >;
  getMyPermissions(workspaceId: string, userId: string): Promise<MemberPermissions>;
  updateMemberPermissions(
    workspaceId: string,
    targetUserId: string,
    perms: Partial<MemberPermissions> & { reset?: boolean },
  ): ReturnType<IWorkspaceRepository['updateMemberCustomPermissions']>;
  getStats(workspaceId: string): ReturnType<IWorkspaceRepository['getStats']>;
  removeMember(
    workspaceId: string,
    targetUserId: string,
    requestingUserId: string,
  ): ReturnType<IWorkspaceRepository['removeMember']>;
}

export class WorkspaceService implements IWorkspaceService {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  private async ensureUniqueSlug(name: string, excludeId?: string): Promise<string> {
    let slug = generateSlug(name);
    let attempt = 0;

    while (await this.workspaceRepository.isSlugTaken(slug, excludeId)) {
      attempt++;
      slug = `${generateSlug(name)}-${attempt}`;
    }

    return slug;
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = await this.ensureUniqueSlug(dto.name);

    return this.workspaceRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      members: { create: { userId, role: Role.OWNER } },
    });
  }

  findUserWorkspaces(userId: string) {
    return this.workspaceRepository.findUserWorkspaces(userId);
  }

  async findBySlug(slug: string, userId: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new NotFoundError('Workspace');

    const member = await this.workspaceRepository.findMember(workspace.id, userId);
    if (!member) throw new ForbiddenError('You are not a member of this workspace');

    return workspace;
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto) {
    const updateData: Record<string, unknown> = { ...dto };

    if (dto.name) {
      updateData.slug = await this.ensureUniqueSlug(dto.name, workspaceId);
    }

    return this.workspaceRepository.update(workspaceId, updateData);
  }

  async delete(workspaceId: string, userId: string) {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    if (!member || member.role !== Role.OWNER) {
      throw new ForbiddenError('Only the workspace owner can delete it');
    }
    return this.workspaceRepository.delete(workspaceId);
  }

  async getMembers(workspaceId: string) {
    const members = await this.workspaceRepository.findMembers(workspaceId);
    return members.map((member) => ({
      ...member,
      permissions: computePermissions(
        member.role,
        member.customPermissions as Record<string, boolean> | null,
      ),
    }));
  }

  async inviteMember(workspaceId: string, dto: InviteMemberDto) {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw new NotFoundError('User with this email');

    const existing = await this.workspaceRepository.findMember(workspaceId, user.id);
    if (existing) throw new ConflictError('User is already a member of this workspace');

    return this.workspaceRepository.addMember(workspaceId, user.id, dto.role);
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    requestingUserId: string,
  ) {
    const requester = await this.workspaceRepository.findMember(workspaceId, requestingUserId);
    if (!requester || requester.role !== Role.OWNER) {
      throw new ForbiddenError('Only the workspace owner can change roles');
    }

    if (targetUserId === requestingUserId) {
      throw new ForbiddenError('You cannot change your own role');
    }

    const target = await this.workspaceRepository.findMember(workspaceId, targetUserId);
    if (!target) throw new NotFoundError('Workspace member');

    if (dto.role === Role.OWNER) {
      throw new ForbiddenError('Cannot assign OWNER role');
    }

    return this.workspaceRepository.updateMemberRole(workspaceId, targetUserId, dto.role);
  }

  async getMember(workspaceId: string, userId: string) {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    if (!member) throw new NotFoundError('Workspace member');
    return {
      ...member,
      permissions: computePermissions(
        member.role,
        member.customPermissions as Record<string, boolean> | null,
      ),
    };
  }

  async getMyPermissions(workspaceId: string, userId: string): Promise<MemberPermissions> {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    if (!member) throw new ForbiddenError('Not a member');
    return computePermissions(
      member.role,
      member.customPermissions as Record<string, boolean> | null,
    );
  }

  async updateMemberPermissions(
    workspaceId: string,
    targetUserId: string,
    perms: Partial<MemberPermissions> & { reset?: boolean },
  ) {
    const member = await this.workspaceRepository.findMember(workspaceId, targetUserId);
    if (!member) throw new NotFoundError('Workspace member');
    const customPermissions = perms.reset
      ? null
      : { ...((member.customPermissions as Record<string, unknown> | null) ?? {}), ...perms };
    return this.workspaceRepository.updateMemberCustomPermissions(
      workspaceId,
      targetUserId,
      customPermissions,
    );
  }

  getStats(workspaceId: string) {
    return this.workspaceRepository.getStats(workspaceId);
  }

  async removeMember(workspaceId: string, targetUserId: string, requestingUserId: string) {
    const requester = await this.workspaceRepository.findMember(workspaceId, requestingUserId);
    if (!requester) throw new ForbiddenError();

    if (targetUserId === requestingUserId) {
      if (requester.role === Role.OWNER) {
        throw new ForbiddenError('Owner cannot leave. Transfer ownership first.');
      }
    } else {
      if (requester.role === Role.MEMBER || requester.role === Role.VIEWER) {
        throw new ForbiddenError('Insufficient permissions to remove members');
      }

      const target = await this.workspaceRepository.findMember(workspaceId, targetUserId);
      if (target?.role === Role.OWNER) {
        throw new ForbiddenError('Cannot remove the workspace owner');
      }
    }

    return this.workspaceRepository.removeMember(workspaceId, targetUserId);
  }
}
