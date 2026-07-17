import { InvitationStatus, Role } from '@prisma/client';
import { IInvitationRepository } from '../repositories/invitation.repository';
import { IWorkspaceRepository } from '../repositories/workspace.repository';
import { IUserRepository } from '../repositories/user.repository';
import { INotificationRepository } from '../repositories/notification.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/error.util';
import { IEmailService } from './email.service';
import { resolveLocale } from '../utils/locale.util';

export interface InvitationDto {
  id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  workspaceId: string;
  invitedBy: string;
  createdAt: string;
  workspace: { id: string; name: string; slug: string };
  inviterName?: string;
}

export interface IInvitationService {
  send(
    workspaceId: string,
    invitedByUserId: string,
    email: string,
    role: Role | undefined,
    origin: string,
  ): Promise<InvitationDto>;
  getByWorkspace(workspaceId: string): Promise<InvitationDto[]>;
  getPendingForUser(email: string): Promise<InvitationDto[]>;
  accept(invitationId: string, userId: string): Promise<{ workspaceSlug: string }>;
  decline(invitationId: string, userId: string): Promise<void>;
  cancel(invitationId: string, workspaceId: string): Promise<void>;
  declineStaleInvitations(): Promise<number>;
}

// Deps-object constructor: named fields avoid argument-order mistakes with this many
// same-shaped repository dependencies.
export interface InvitationServiceDeps {
  invitationRepository: IInvitationRepository;
  workspaceRepository: IWorkspaceRepository;
  userRepository: IUserRepository;
  notificationRepository: INotificationRepository;
  emailService: IEmailService;
}

function toDto(inv: {
  id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  workspaceId: string;
  invitedBy: string;
  createdAt: Date;
  workspace: { id: string; name: string; slug: string };
  inviter?: { name: string } | null;
}): InvitationDto {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status: inv.status,
    workspaceId: inv.workspaceId,
    invitedBy: inv.invitedBy,
    createdAt: inv.createdAt.toISOString(),
    workspace: inv.workspace,
    inviterName: inv.inviter?.name,
  };
}

export class InvitationService implements IInvitationService {
  constructor(private readonly deps: InvitationServiceDeps) {}

  async send(
    workspaceId: string,
    invitedByUserId: string,
    email: string,
    role: Role = Role.MEMBER,
    origin = '',
  ): Promise<InvitationDto> {
    const {
      invitationRepository,
      workspaceRepository,
      userRepository,
      notificationRepository,
      emailService,
    } = this.deps;

    // Independent lookups run together. `inviter` is always needed for the "who invited
    // you" name, and doubles as the locale fallback when the invitee has no account yet.
    const [workspace, existingUser, existingInvitation, inviter] = await Promise.all([
      workspaceRepository.findById(workspaceId),
      userRepository.findByEmail(email),
      invitationRepository.findExisting(workspaceId, email),
      userRepository.findById(invitedByUserId),
    ]);
    if (!workspace) throw new NotFoundError('Workspace');

    if (existingUser) {
      const member = await workspaceRepository.findMember(workspaceId, existingUser.id);
      if (member) throw new ConflictError('User is already a member of this workspace');
    }

    if (existingInvitation) throw new ConflictError('Invitation already sent to this email');

    const invitation = await invitationRepository.create(workspaceId, email, role, invitedByUserId);
    const inviterName = inviter?.name ?? 'Someone';

    if (existingUser) {
      await notificationRepository.createWithType(
        existingUser.id,
        'INVITATION',
        `Invitation to ${workspace.name}`,
        `${inviterName} invited you to join ${workspace.name}`,
        {
          invitationId: invitation.id,
          workspaceId,
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
        },
      );
    }

    // Email goes out either way. Locale: invitee's own preference if they have an account,
    // else fall back to the inviter's locale.
    const locale = resolveLocale(existingUser?.locale ?? inviter?.locale);
    const link = `${origin}/login`;
    emailService
      .sendWorkspaceInvitation(email, inviterName, workspace.name, link, locale)
      .catch((err) => console.error('[Email] Failed to send workspace invitation:', err));

    return toDto(invitation);
  }

  async getByWorkspace(workspaceId: string): Promise<InvitationDto[]> {
    const invitations = await this.deps.invitationRepository.findByWorkspace(workspaceId);
    return invitations.map(toDto);
  }

  async getPendingForUser(email: string): Promise<InvitationDto[]> {
    const invitations = await this.deps.invitationRepository.findPendingByEmail(email);
    return invitations.map(toDto);
  }

  async accept(invitationId: string, userId: string): Promise<{ workspaceSlug: string }> {
    const { invitationRepository, workspaceRepository, userRepository } = this.deps;

    // Independent lookups — no need to wait on one before starting the other.
    const [invitation, user] = await Promise.all([
      invitationRepository.findById(invitationId),
      userRepository.findById(userId),
    ]);
    if (!invitation) throw new NotFoundError('Invitation');
    if (invitation.status !== 'PENDING') throw new ConflictError('Invitation is no longer pending');
    if (new Date() > invitation.expiresAt) throw new ForbiddenError('Invitation has expired');

    if (!user || user.email !== invitation.email) {
      throw new ForbiddenError('This invitation was not sent to you');
    }

    const existing = await workspaceRepository.findMember(invitation.workspaceId, userId);
    if (!existing) {
      await workspaceRepository.addMember(invitation.workspaceId, userId, invitation.role);
    }

    await invitationRepository.updateStatus(invitationId, 'ACCEPTED');
    return { workspaceSlug: invitation.workspace?.slug ?? '' };
  }

  async decline(invitationId: string, userId: string): Promise<void> {
    const { invitationRepository, userRepository } = this.deps;

    const [invitation, user] = await Promise.all([
      invitationRepository.findById(invitationId),
      userRepository.findById(userId),
    ]);
    if (!invitation) throw new NotFoundError('Invitation');

    if (!user || user.email !== invitation.email) {
      throw new ForbiddenError('This invitation was not sent to you');
    }

    await invitationRepository.updateStatus(invitationId, 'DECLINED');
  }

  async cancel(invitationId: string, workspaceId: string): Promise<void> {
    const invitation = await this.deps.invitationRepository.findById(invitationId);
    if (!invitation || invitation.workspaceId !== workspaceId)
      throw new NotFoundError('Invitation');
    await this.deps.invitationRepository.delete(invitationId);
  }

  // Invitations expire after 3 days but nothing flips their status automatically, so a
  // stale invite would sit as PENDING forever and block re-invites. Called on a timer
  // from server.ts.
  declineStaleInvitations(): Promise<number> {
    return this.deps.invitationRepository.declineStale();
  }
}
