import { Request, Response, NextFunction } from 'express';
import { Role, WorkspaceMember } from '@prisma/client';
import { IWorkspaceRepository } from '../repositories/workspace.repository';
import { ForbiddenError, UnauthorizedError } from '../utils/error.util';
import { ROLES_HIERARCHY } from '../config/constants';

// Template Method: resolve a parent entity -> look up membership -> compare role
// hierarchy -> attach to req. Subclasses only override how the workspace is resolved
// and what gets attached.
export abstract class BaseRoleGuard {
  constructor(protected readonly workspaceRepository: IWorkspaceRepository) {}

  guard(...roles: Role[]) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) throw new UnauthorizedError();

      const workspaceId = await this.resolveWorkspaceId(req);
      const member = await this.workspaceRepository.findMember(workspaceId, req.user.id);
      if (!member) throw new ForbiddenError('You are not a member of this workspace');

      const minHierarchy = Math.min(...roles.map((r) => ROLES_HIERARCHY[r]));
      if (ROLES_HIERARCHY[member.role] < minHierarchy) {
        throw new ForbiddenError('Insufficient permissions');
      }

      this.attach(req, member, workspaceId);
      next();
    };
  }

  protected abstract resolveWorkspaceId(req: Request): Promise<string>;
  protected abstract attach(req: Request, member: WorkspaceMember, workspaceId: string): void;
}
