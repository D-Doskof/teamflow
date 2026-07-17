import path from 'path';
import fs from 'fs/promises';
import { Request } from 'express';
import { env } from '../config/env';

export interface IUploadService {
  buildFileUrl(req: Request, filename: string): string;
  deleteFile(filename: string): Promise<void>;
  extractFilename(url: string): string;
}

export class UploadService implements IUploadService {
  buildFileUrl(req: Request, filename: string): string {
    const host = `${req.protocol}://${req.get('host')}`;
    return `${host}/uploads/${filename}`;
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(process.cwd(), env.UPLOAD_DIR, filename);
    await fs.unlink(filePath).catch(() => null);
  }

  extractFilename(url: string): string {
    return url.split('/').pop() ?? '';
  }
}
