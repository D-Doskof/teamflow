import { Request, Response } from 'express';
import { IProjectService } from '../services/project.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';

export class ProjectController {
  constructor(private readonly projectService: IProjectService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const project = await this.projectService.create(req.workspaceMember!.workspaceId, req.body);
    sendCreated(res, project, 'Project created');
  };

  findAll = async (req: Request, res: Response): Promise<void> => {
    const includeArchived = req.query.archived === 'true';
    const projects = await this.projectService.findByWorkspace(
      req.workspaceMember!.workspaceId,
      req.user!.id,
      includeArchived,
    );
    sendSuccess(res, projects);
  };

  findOne = async (req: Request, res: Response): Promise<void> => {
    const project = await this.projectService.findById(req.params.projectId);
    sendSuccess(res, project);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const project = await this.projectService.update(req.params.projectId, req.body);
    sendSuccess(res, project, 'Project updated');
  };

  archive = async (req: Request, res: Response): Promise<void> => {
    await this.projectService.archive(req.params.projectId);
    sendSuccess(res, null, 'Project archived');
  };

  unarchive = async (req: Request, res: Response): Promise<void> => {
    await this.projectService.unarchive(req.params.projectId);
    sendSuccess(res, null, 'Project unarchived');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.projectService.delete(req.params.projectId);
    sendNoContent(res);
  };

  createLabel = async (req: Request, res: Response): Promise<void> => {
    const label = await this.projectService.createLabel(req.params.projectId, req.body);
    sendCreated(res, label, 'Label created');
  };

  getLabels = async (req: Request, res: Response): Promise<void> => {
    const labels = await this.projectService.getLabels(req.params.projectId);
    sendSuccess(res, labels);
  };

  deleteLabel = async (req: Request, res: Response): Promise<void> => {
    await this.projectService.deleteLabel(req.params.labelId);
    sendNoContent(res);
  };
}
