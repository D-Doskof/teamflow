import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ITaskService } from '../services/task.service';
import { IUploadService } from '../services/upload.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.util';
import { env } from '../config/env';
import { ALLOWED_ATTACHMENT_MIME_TYPES } from '../config/constants';

export class TaskController {
  constructor(
    private readonly taskService: ITaskService,
    private readonly uploadService: IUploadService,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const task = await this.taskService.create(req.params.taskListId, req.user!.id, req.body);
    sendCreated(res, task, 'Task created');
  };

  findByBoard = async (req: Request, res: Response): Promise<void> => {
    const result = await this.taskService.findByBoard(req.params.boardId, req.query as never);
    sendSuccess(res, result.tasks, 'OK', 200, result.meta);
  };

  findOne = async (req: Request, res: Response): Promise<void> => {
    const task = await this.taskService.findById(req.params.taskId);
    sendSuccess(res, task);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const task = await this.taskService.update(req.params.taskId, req.user!.id, req.body);
    sendSuccess(res, task, 'Task updated');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.taskService.delete(req.params.taskId);
    sendNoContent(res);
  };

  // Assignees — body-based to match frontend
  assignUser = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.body;
    const task = await this.taskService.assignUser(req.params.taskId, userId, req.user!.id);
    sendSuccess(res, task, 'User assigned');
  };

  unassignUser = async (req: Request, res: Response): Promise<void> => {
    const task = await this.taskService.unassignUser(
      req.params.taskId,
      req.params.userId,
      req.user!.id,
    );
    sendSuccess(res, task, 'User unassigned');
  };

  addLabel = async (req: Request, res: Response): Promise<void> => {
    const task = await this.taskService.addLabel(
      req.params.taskId,
      req.params.labelId,
      req.user!.id,
    );
    sendSuccess(res, task, 'Label added');
  };

  removeLabel = async (req: Request, res: Response): Promise<void> => {
    const task = await this.taskService.removeLabel(
      req.params.taskId,
      req.params.labelId,
      req.user!.id,
    );
    sendSuccess(res, task, 'Label removed');
  };

  // Attachments — accept base64 JSON, save to disk
  listAttachments = async (req: Request, res: Response): Promise<void> => {
    const attachments = await this.taskService.listAttachments(req.params.taskId);
    sendSuccess(res, attachments);
  };

  uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      mimeType,
      size,
      data: base64Data,
    } = req.body as {
      name: string;
      mimeType: string;
      size: number;
      data: string; // "data:<mime>;base64,<content>"
    };

    const allowedExts = ALLOWED_ATTACHMENT_MIME_TYPES[mimeType];
    if (!allowedExts) {
      res.status(400).json({ success: false, message: 'File type not allowed' });
      return;
    }

    if (typeof size !== 'number' || size <= 0 || size > env.MAX_FILE_SIZE) {
      res.status(400).json({ success: false, message: 'File exceeds the maximum allowed size' });
      return;
    }

    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches || matches[1] !== mimeType) {
      res.status(400).json({ success: false, message: 'Invalid base64 data' });
      return;
    }

    const content = Buffer.from(matches[2], 'base64');
    if (content.length > env.MAX_FILE_SIZE) {
      res.status(400).json({ success: false, message: 'File exceeds the maximum allowed size' });
      return;
    }

    // Extension comes from the validated mime type, never the client-supplied filename,
    // so an attacker can't smuggle in an executable extension.
    const ext = allowedExts[0];
    const filename = `${uuidv4()}${ext}`;
    const uploadPath = path.join(process.cwd(), env.UPLOAD_DIR, filename);

    fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    fs.writeFileSync(uploadPath, content);

    const url = this.uploadService.buildFileUrl(req, filename);
    const attachment = await this.taskService.addAttachment(req.params.taskId, req.user!.id, {
      name,
      url,
      mimeType,
      size: content.length,
    });

    sendCreated(res, { ...attachment, data: url }, 'Attachment uploaded');
  };

  getAttachment = async (req: Request, res: Response): Promise<void> => {
    const attachment = await this.taskService.getAttachment(req.params.attachmentId);

    // Not served from a public static path — read from disk (route is gated by
    // project-membership middleware) and return as a data URI.
    const filename = this.uploadService.extractFilename(attachment.url);
    const filePath = path.join(process.cwd(), env.UPLOAD_DIR, filename);

    let data: string;
    try {
      const content = fs.readFileSync(filePath);
      data = `data:${attachment.mimeType};base64,${content.toString('base64')}`;
    } catch {
      res.status(404).json({ success: false, message: 'File not found on disk' });
      return;
    }

    sendSuccess(res, { ...attachment, data });
  };

  deleteAttachment = async (req: Request, res: Response): Promise<void> => {
    await this.taskService.deleteAttachment(req.params.attachmentId, req.user!.id);
    sendNoContent(res);
  };

  getActivity = async (req: Request, res: Response): Promise<void> => {
    const activity = await this.taskService.getActivity(req.params.taskId);
    sendSuccess(res, activity);
  };
}
