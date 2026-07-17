import { Request } from 'express';
import { WorkspaceMember } from '@prisma/client';
import { NotFoundError } from '../utils/error.util';
import { BaseRoleGuard } from './BaseRoleGuard';

export class WorkspaceRoleGuard extends BaseRoleGuard {
  protected async resolveWorkspaceId(req: Request): Promise<string> {
    const { workspaceSlug } = req.params;
    if (!workspaceSlug) throw new NotFoundError('Workspace');

    const workspace = await this.workspaceRepository.findBySlug(workspaceSlug);
    if (!workspace) throw new NotFoundError('Workspace');

    return workspace.id;
  }

  protected attach(req: Request, member: WorkspaceMember, workspaceId: string): void {
    req.workspaceMember = { id: member.id, role: member.role, workspaceId };
  }
}
