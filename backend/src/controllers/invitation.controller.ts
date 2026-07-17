import { Request, Response } from 'express';
import { IInvitationService } from '../services/invitation.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';
import { Role } from '@prisma/client';

export class InvitationController {
  constructor(private readonly invitationService: IInvitationService) {}

  send = async (req: Request, res: Response): Promise<void> => {
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

  getByWorkspace = async (req: Request, res: Response): Promise<void> => {
    const invitations = await this.invitationService.getByWorkspace(
      req.workspaceMember!.workspaceId,
    );
    sendSuccess(res, invitations);
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    await this.invitationService.cancel(req.params.invId, req.workspaceMember!.workspaceId);
    sendNoContent(res);
  };

  getPending = async (req: Request, res: Response): Promise<void> => {
    const invitations = await this.invitationService.getPendingForUser(req.user!.email);
    sendSuccess(res, invitations);
  };

  accept = async (req: Request, res: Response): Promise<void> => {
    const result = await this.invitationService.accept(req.params.invId, req.user!.id);
    sendSuccess(res, result, 'Invitation accepted');
  };

  decline = async (req: Request, res: Response): Promise<void> => {
    await this.invitationService.decline(req.params.invId, req.user!.id);
    sendNoContent(res);
  };
}
