import { IProjectRepository } from '../repositories/project.repository';
import { IWorkspaceRepository } from '../repositories/workspace.repository';
import { ForbiddenError, NotFoundError } from '../utils/error.util';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateLabelDto,
} from '../validators/project.validator';

export interface IProjectService {
  create(workspaceId: string, dto: CreateProjectDto): ReturnType<IProjectRepository['create']>;
  findByWorkspace(
    workspaceId: string,
    userId: string,
    includeArchived?: boolean,
  ): Promise<unknown[]>;
  findById(projectId: string): ReturnType<IProjectRepository['findByIdWithDetails']>;
  update(projectId: string, dto: UpdateProjectDto): ReturnType<IProjectRepository['update']>;
  archive(projectId: string): ReturnType<IProjectRepository['update']>;
  unarchive(projectId: string): ReturnType<IProjectRepository['update']>;
  delete(projectId: string): ReturnType<IProjectRepository['delete']>;
  createLabel(
    projectId: string,
    dto: CreateLabelDto,
  ): ReturnType<IProjectRepository['createLabel']>;
  getLabels(projectId: string): ReturnType<IProjectRepository['findLabels']>;
  deleteLabel(labelId: string): ReturnType<IProjectRepository['deleteLabel']>;
}

export class ProjectService implements IProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly workspaceRepository: IWorkspaceRepository,
  ) {}

  async create(workspaceId: string, dto: CreateProjectDto) {
    return this.projectRepository.create({
      name: dto.name,
      description: dto.description,
      icon: dto.icon,
      color: dto.color,
      workspace: { connect: { id: workspaceId } },
    });
  }

  async findByWorkspace(workspaceId: string, userId: string, includeArchived = false) {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    if (!member) throw new ForbiddenError('You are not a member of this workspace');

    const [projects, memberCount] = await Promise.all([
      this.projectRepository.findByWorkspace(workspaceId, includeArchived),
      this.workspaceRepository.countMembers(workspaceId),
    ]);

    // Projects have no membership of their own — every workspace member has access,
    // so the "members" count shown per project is the workspace's member count.
    return projects.map((p) => ({ ...p, _count: { ...p._count, members: memberCount } }));
  }

  async findById(projectId: string) {
    // Access is already gated by requireProjectRole (workspace-membership-based) at
    // the route level, so this only needs to load the project itself.
    const project = await this.projectRepository.findByIdWithDetails(projectId);
    if (!project) throw new NotFoundError('Project');

    return project;
  }

  async update(projectId: string, dto: UpdateProjectDto) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    return this.projectRepository.update(projectId, dto);
  }

  archive(projectId: string) {
    return this.projectRepository.update(projectId, { isArchived: true });
  }

  unarchive(projectId: string) {
    return this.projectRepository.update(projectId, { isArchived: false });
  }

  async delete(projectId: string) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError('Project');
    return this.projectRepository.delete(projectId);
  }

  createLabel(projectId: string, dto: CreateLabelDto) {
    return this.projectRepository.createLabel(projectId, dto.name, dto.color);
  }

  getLabels(projectId: string) {
    return this.projectRepository.findLabels(projectId);
  }

  deleteLabel(labelId: string) {
    return this.projectRepository.deleteLabel(labelId);
  }
}
