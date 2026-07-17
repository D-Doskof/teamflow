import { Request, Response } from 'express';
import { ISearchService } from '../services/search.service';
import { sendSuccess } from '../utils/response.util';

export class SearchController {
  constructor(private readonly searchService: ISearchService) {}

  search = async (req: Request, res: Response): Promise<void> => {
    const { q } = req.query as { q: string };
    const results = await this.searchService.search(req.user!.id, q);
    sendSuccess(res, results);
  };
}
