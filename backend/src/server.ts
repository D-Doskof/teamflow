import 'express-async-errors';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './database/prisma';
import { invitationService } from './container';

const INVITATION_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  console.log('✅ Database connected');

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`🚀 TeamFlow API running on http://localhost:${env.PORT}`);
    console.log(`📖 Environment: ${env.NODE_ENV}`);
  });

  const sweepStaleInvitations = () => {
    invitationService.declineStaleInvitations().catch((err) => {
      console.error('Failed to decline stale invitations:', err);
    });
  };
  sweepStaleInvitations();
  setInterval(sweepStaleInvitations, INVITATION_SWEEP_INTERVAL_MS);
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
