import { Router } from 'express';
import { searchController } from '../container';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { searchQuerySchema } from '../validators/search.validator';

export const searchRouter = Router();

searchRouter.use(authenticate);
searchRouter.get('/', validate(searchQuerySchema, 'query'), searchController.search);
