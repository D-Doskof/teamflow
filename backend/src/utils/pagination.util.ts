import { PAGINATION } from '../config/constants';
import { PaginationMeta, PaginationQuery } from '../types';

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function getPaginationParams(query: PaginationQuery): PaginationParams {
  const page = Math.max(1, Number(query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, Number(query.limit) || PAGINATION.DEFAULT_LIMIT),
  );
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
