import { Router } from 'express';
import { workspaceController, requireWorkspaceRole } from '../container';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '../validators/workspace.validator';
import { projectRouter } from './project.routes';

export const workspaceRouter = Router();

workspaceRouter.use(authenticate);

workspaceRouter.get('/', workspaceController.findAll);
workspaceRouter.post('/', validate(createWorkspaceSchema), workspaceController.create);

workspaceRouter.get(
  '/:workspaceSlug',
  requireWorkspaceRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  workspaceController.findOne,
);
workspaceRouter.patch(
  '/:workspaceSlug',
  requireWorkspaceRole('ADMIN', 'OWNER'),
  validate(updateWorkspaceSchema),
  workspaceController.update,
);
workspaceRouter.delete(
  '/:workspaceSlug',
  requireWorkspaceRole('OWNER'),
  workspaceController.delete,
);
workspaceRouter.get(
  '/:workspaceSlug/stats',
  requireWorkspaceRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  workspaceController.getStats,
);

// Current user in workspace
workspaceRouter.get(
  '/:workspaceSlug/me',
  requireWorkspaceRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  workspaceController.getMe,
);
workspaceRouter.get(
  '/:workspaceSlug/me/permissions',
  requireWorkspaceRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  workspaceController.getMyPermissions,
);

// Members
workspaceRouter.get(
  '/:workspaceSlug/members',
  requireWorkspaceRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  workspaceController.getMembers,
);
workspaceRouter.post(
  '/:workspaceSlug/members',
  requireWorkspaceRole('ADMIN', 'OWNER'),
  validate(inviteMemberSchema),
  workspaceController.inviteMember,
);
workspaceRouter.patch(
  '/:workspaceSlug/members/:userId',
  requireWorkspaceRole('OWNER'),
  validate(updateMemberRoleSchema),
  workspaceController.updateMemberRole,
);
workspaceRouter.patch(
  '/:workspaceSlug/members/:userId/permissions',
  requireWorkspaceRole('ADMIN', 'OWNER'),
  workspaceController.updateMemberPermissions,
);
workspaceRouter.delete(
  '/:workspaceSlug/members/:userId',
  requireWorkspaceRole('MEMBER', 'ADMIN', 'OWNER'),
  workspaceController.removeMember,
);

// Invitations
workspaceRouter.get(
  '/:workspaceSlug/invitations',
  requireWorkspaceRole('ADMIN', 'OWNER'),
  workspaceController.getInvitations,
);
workspaceRouter.post(
  '/:workspaceSlug/invitations',
  requireWorkspaceRole('ADMIN', 'OWNER'),
  workspaceController.sendInvitation,
);
workspaceRouter.delete(
  '/:workspaceSlug/invitations/:invId',
  requireWorkspaceRole('ADMIN', 'OWNER'),
  workspaceController.cancelInvitation,
);

// Projects (nested)
workspaceRouter.use(
  '/:workspaceSlug/projects',
  requireWorkspaceRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  projectRouter,
);
