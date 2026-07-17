import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { globalRateLimiter } from './middlewares/rateLimiter.middleware';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import { router } from './routes';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        // Allow configured origin, localhost, and local network IPs
        const allowed =
          origin === env.CORS_ORIGIN ||
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(
            origin,
          ) ||
          // Temporary Cloudflare Quick Tunnel origin, for testing from phones when the
          // browser refuses to load the LAN IP over plain HTTP (see docker-compose.yml).
          /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin);
        callback(allowed ? null : new Error('CORS: not allowed'), allowed);
      },
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(globalRateLimiter);

  app.use((req, res, next) => {
    const start = Date.now();
    // Redact query params (in particular the SSE endpoint's ?token=<JWT>) so access
    // tokens never end up sitting in plaintext in stdout/Docker logs.
    const safeUrl = req.originalUrl.split('?')[0];
    res.on('finish', () => {
      console.log(`[req] ${req.method} ${safeUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', router);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
