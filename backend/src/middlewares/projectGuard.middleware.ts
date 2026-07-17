import { Request } from 'express';
import { WorkspaceMember } from '@prisma/client';
import { IWorkspaceRepository } from '../repositories/workspace.repository';
import { IProjectRepository } from '../repositories/project.repository';
import { NotFoundError } from '../utils/error.util';
import { BaseRoleGuard } from './BaseRoleGuard';

export class ProjectRoleGuard extends BaseRoleGuard {
  constructor(
    workspaceRepository: IWorkspaceRepository,
    private readonly projectRepository: IProjectRepository,
  ) {
    super(workspaceRepository);
  }

  // Projects have no membership list of their own — a project belongs to exactly one
  // workspace, so access is governed entirely by that workspace's membership/role.
  protected async resolveWorkspaceId(req: Request): Promise<string> {
    const { projectId } = req.params;
    if (!projectId) throw new NotFoundError('Project');

    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError('Project');

    return project.workspaceId;
  }

  protected attach(req: Request, member: WorkspaceMember): void {
    req.projectMember = { id: member.id, role: member.role, projectId: req.params.projectId };
  }
}
