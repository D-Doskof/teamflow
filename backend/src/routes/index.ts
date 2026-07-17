import { Router, Request, Response } from 'express';
import { authRouter } from './auth.routes';
import { workspaceRouter } from './workspace.routes';
import { notificationRouter } from './notification.routes';
import { invitationRouter } from './invitation.routes';
import { searchRouter } from './search.routes';
import { verifyAccessToken } from '../utils/jwt.util';
import { sseBroadcaster } from '../realtime/EventBroadcaster';

export const router = Router();

// SSE endpoint — auth via ?token= query param, since the browser's native EventSource
// API has no way to set an Authorization header (unlike every other route, which uses
// the `authenticate` middleware and a Bearer header).
router.get('/events', (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(401).json({ success: false, message: 'No token provided' });
    return;
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).userId;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = `${userId}-${Date.now()}`;
  sseBroadcaster.subscribe(clientId, res);
  res.write('event: ping\ndata: {}\n\n');

  const hb = setInterval(() => {
    try {
      res.write('event: ping\ndata: {}\n\n');
    } catch {
      /* ignore */
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(hb);
    sseBroadcaster.unsubscribe(clientId);
  });
});

router.use('/auth', authRouter);
router.use('/workspaces', workspaceRouter);
router.use('/notifications', notificationRouter);
router.use('/invitations', invitationRouter);
router.use('/search', searchRouter);
