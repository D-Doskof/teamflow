import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { UnauthorizedError } from '../utils/error.util';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  // Reject anything that isn't a real access token (e.g. a pending-2FA token, which is
  // signed with the same secret but must never be usable as a session token on its own).
  if (payload.type !== 'access') {
    throw new UnauthorizedError('Invalid token type');
  }

  req.user = {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
  };

  next();
}
