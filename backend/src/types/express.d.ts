import { Role } from '@prisma/client';

// @types/express@5 changed params to string | string[], but we use Express 4 where params are always string
declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    [key: string]: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
      workspaceMember?: {
        id: string;
        role: Role;
        workspaceId: string;
      };
      projectMember?: {
        id: string;
        role: Role;
        projectId: string;
      };
    }
  }
}
