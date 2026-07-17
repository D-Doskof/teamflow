import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Dev-mode limit is bumped way up: background polling across a few tabs can add up
// quickly, especially since requests through Docker's port-forwarding share one IP.
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max:
    env.NODE_ENV === 'development' ? env.RATE_LIMIT_MAX_REQUESTS * 20 : env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 200 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts.' },
});
