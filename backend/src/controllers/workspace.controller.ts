import { Request, Response } from 'express';
import { IWorkspaceService } from '../services/workspace.service';
import { IInvitationService } from '../services/invitation.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';
import { Role } from '@prisma/client';

export class WorkspaceController {
  constructor(
    private readonly workspaceService: IWorkspaceService,
    private readonly invitationService: IInvitationService,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.create(req.user!.id, req.body);
    sendCreated(res, workspace, 'Workspace created');
  };

  findAll = async (req: Request, res: Response): Promise<void> => {
    const workspaces = await this.workspaceService.findUserWorkspaces(req.user!.id);
    sendSuccess(res, workspaces);
  };

  findOne = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.findBySlug(
      req.params.workspaceSlug,
      req.user!.id,
    );
    sendSuccess(res, workspace);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const workspace = await this.workspaceService.update(
      req.workspaceMember!.workspaceId,
      req.body,
    );
    sendSuccess(res, workspace, 'Workspace updated');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.workspaceService.delete(req.workspaceMember!.workspaceId, req.user!.id);
    sendNoContent(res);
  };

  getMembers = async (req: Request, res: Response): Promise<void> => {
    const members = await this.workspaceService.getMembers(req.workspaceMember!.workspaceId);
    sendSuccess(res, members);
  };

  inviteMember = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.inviteMember(
      req.workspaceMember!.workspaceId,
      req.body,
    );
    sendCreated(res, member, 'Member invited successfully');
  };

  updateMemberRole = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.updateMemberRole(
      req.workspaceMember!.workspaceId,
      req.params.userId,
      req.body,
      req.user!.id,
    );
    sendSuccess(res, member, 'Role updated');
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    await this.workspaceService.removeMember(
      req.workspaceMember!.workspaceId,
      req.params.userId,
      req.user!.id,
    );
    sendNoContent(res);
  };

  getMe = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.getMember(
      req.workspaceMember!.workspaceId,
      req.user!.id,
    );
    sendSuccess(res, member);
  };

  getMyPermissions = async (req: Request, res: Response): Promise<void> => {
    const permissions = await this.workspaceService.getMyPermissions(
      req.workspaceMember!.workspaceId,
      req.user!.id,
    );
    sendSuccess(res, permissions);
  };

  updateMemberPermissions = async (req: Request, res: Response): Promise<void> => {
    const member = await this.workspaceService.updateMemberPermissions(
      req.workspaceMember!.workspaceId,
      req.params.userId,
      req.body,
    );
    sendSuccess(res, member, 'Permissions updated');
  };

  getStats = async (req: Request, res: Response): Promise<void> => {
    const stats = await this.workspaceService.getStats(req.workspaceMember!.workspaceId);
    sendSuccess(res, stats);
  };

  // Invitation management (workspace-level)
  sendInvitation = async (req: Request, res: Response): Promise<void> => {
    // Same origin-header fallback as forgotPassword — link must point at whatever host the inviter is on.
    const origin = req.get('origin') ?? `${req.protocol}://${req.get('host')}`;
    const inv = await this.invitationService.send(
      req.workspaceMember!.workspaceId,
      req.user!.id,
      req.body.email,
      (req.body.role as Role) ?? Role.MEMBER,
      origin,
    );
    sendCreated(res, inv, 'Invitation sent');
  };

  getInvitations = async (req: Request, res: Response): Promise<void> => {
    const invitations = await this.invitationService.getByWorkspace(
      req.workspaceMember!.workspaceId,
    );
    sendSuccess(res, invitations);
  };

  cancelInvitation = async (req: Request, res: Response): Promise<void> => {
    await this.invitationService.cancel(req.params.invId, req.workspaceMember!.workspaceId);
    sendNoContent(res);
  };
}
