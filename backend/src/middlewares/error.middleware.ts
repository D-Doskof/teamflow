import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AppError } from '../utils/error.util';
import { sendError } from '../utils/response.util';
import { env } from '../config/env';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.errors, err.code);
  }

  if (err instanceof ZodError) {
    return sendError(res, 'Validation failed', 422, err.flatten().fieldErrors);
  }

  if (err instanceof TokenExpiredError) {
    return sendError(res, 'Token expired', 401);
  }

  if (err instanceof JsonWebTokenError) {
    return sendError(res, 'Invalid token', 401);
  }

  if (env.NODE_ENV === 'development') {
    console.error(err);
  }

  return sendError(res, 'Internal server error', 500);
}

export function notFoundMiddleware(_req: Request, res: Response): Response {
  return sendError(res, 'Route not found', 404);
}
