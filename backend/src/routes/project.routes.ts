import { Router } from 'express';
import { projectController, requireProjectRole } from '../container';
import { validate } from '../middlewares/validate.middleware';
import {
  createProjectSchema,
  updateProjectSchema,
  createLabelSchema,
} from '../validators/project.validator';
import { boardRouter } from './board.routes';

export const projectRouter = Router({ mergeParams: true });

projectRouter.get('/', projectController.findAll);
projectRouter.post('/', validate(createProjectSchema), projectController.create);

projectRouter.get(
  '/:projectId',
  requireProjectRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  projectController.findOne,
);
projectRouter.patch(
  '/:projectId',
  requireProjectRole('ADMIN', 'OWNER'),
  validate(updateProjectSchema),
  projectController.update,
);
projectRouter.delete('/:projectId', requireProjectRole('OWNER'), projectController.delete);
projectRouter.post(
  '/:projectId/archive',
  requireProjectRole('ADMIN', 'OWNER'),
  projectController.archive,
);
projectRouter.post(
  '/:projectId/unarchive',
  requireProjectRole('ADMIN', 'OWNER'),
  projectController.unarchive,
);

projectRouter.get(
  '/:projectId/labels',
  requireProjectRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  projectController.getLabels,
);
projectRouter.post(
  '/:projectId/labels',
  requireProjectRole('MEMBER', 'ADMIN', 'OWNER'),
  validate(createLabelSchema),
  projectController.createLabel,
);
projectRouter.delete(
  '/:projectId/labels/:labelId',
  requireProjectRole('ADMIN', 'OWNER'),
  projectController.deleteLabel,
);

projectRouter.use(
  '/:projectId/boards',
  requireProjectRole('VIEWER', 'MEMBER', 'ADMIN', 'OWNER'),
  boardRouter,
);
