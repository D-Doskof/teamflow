import { Router } from 'express';
import { invitationController } from '../container';
import { authenticate } from '../middlewares/auth.middleware';

export const invitationRouter = Router();

invitationRouter.use(authenticate);

// My pending invitations
invitationRouter.get('/pending', invitationController.getPending);

// Accept / decline
invitationRouter.post('/:invId/accept', invitationController.accept);
invitationRouter.post('/:invId/decline', invitationController.decline);
