import { Router } from 'express';
import { subtaskController, requireProjectRole } from '../container';

export const subtaskRouter = Router({ mergeParams: true });

const canEdit = requireProjectRole('MEMBER', 'ADMIN', 'OWNER');

subtaskRouter.get('/', subtaskController.findByTask);
subtaskRouter.post('/', canEdit, subtaskController.create);
subtaskRouter.patch('/:subtaskId', canEdit, subtaskController.update);
subtaskRouter.delete('/:subtaskId', canEdit, subtaskController.delete);
