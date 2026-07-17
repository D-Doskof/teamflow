// Composition root: the one place in the app that knows about every concrete class and
// wires them together by hand (no DI framework/decorators — the wiring stays visible).
// Everywhere else (services, controllers, guards) depends only on interfaces, injected
// through constructors, which is what this file supplies.
import { Role } from '@prisma/client';
import { prisma } from './database/prisma';

// ---- Infrastructure singletons (no app-specific dependencies of their own) ----
import { tokenService } from './utils/jwt.util';
import { passwordHasher } from './utils/hash.util';
import { emailService } from './services/email.service';
import { sseBroadcaster } from './realtime/EventBroadcaster';

// ---- Repositories ----
import { ActivityRepository } from './repositories/activity.repository';
import { BoardRepository } from './repositories/board.repository';
import { CommentRepository } from './repositories/comment.repository';
import { EmailVerificationRepository } from './repositories/email-verification.repository';
import { InvitationRepository } from './repositories/invitation.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { ProjectRepository } from './repositories/project.repository';
import { RefreshTokenRepository } from './repositories/refreshToken.repository';
import { SearchRepository } from './repositories/search.repository';
import { SubtaskRepository } from './repositories/subtask.repository';
import { TaskRepository } from './repositories/task.repository';
import { TwoFactorCodeRepository } from './repositories/two-factor-code.repository';
import { UserRepository } from './repositories/user.repository';
import { WorkspaceRepository } from './repositories/workspace.repository';

export const activityRepository = new ActivityRepository(prisma);
export const boardRepository = new BoardRepository(prisma);
export const commentRepository = new CommentRepository(prisma);
export const emailVerificationRepository = new EmailVerificationRepository(prisma);
export const invitationRepository = new InvitationRepository(prisma);
export const notificationRepository = new NotificationRepository(prisma);
export const passwordResetRepository = new PasswordResetRepository(prisma);
export const projectRepository = new ProjectRepository(prisma);
export const refreshTokenRepository = new RefreshTokenRepository(prisma);
export const searchRepository = new SearchRepository(prisma);
export const subtaskRepository = new SubtaskRepository(prisma);
export const taskRepository = new TaskRepository(prisma);
export const twoFactorCodeRepository = new TwoFactorCodeRepository(prisma);
export const userRepository = new UserRepository(prisma);
export const workspaceRepository = new WorkspaceRepository(prisma);

// ---- Role guards (depend on repositories) ----
import { WorkspaceRoleGuard } from './middlewares/workspaceGuard.middleware';
import { ProjectRoleGuard } from './middlewares/projectGuard.middleware';

const workspaceRoleGuard = new WorkspaceRoleGuard(workspaceRepository);
const projectRoleGuard = new ProjectRoleGuard(workspaceRepository, projectRepository);

export function requireWorkspaceRole(...roles: Role[]) {
  return workspaceRoleGuard.guard(...roles);
}

export function requireProjectRole(...roles: Role[]) {
  return projectRoleGuard.guard(...roles);
}

// ---- Domain services (depend on repositories + infrastructure singletons) ----
import { UploadService } from './services/upload.service';
import { NotificationService } from './services/notification.service';
import { BoardService } from './services/board.service';
import { CommentService } from './services/comment.service';
import { SubtaskService } from './services/subtask.service';
import { ProjectService } from './services/project.service';
import { InvitationService } from './services/invitation.service';
import { WorkspaceService } from './services/workspace.service';
import { TaskService } from './services/task.service';
import { AuthService } from './services/auth.service';
import { SearchService } from './services/search.service';

export const uploadService = new UploadService();
export const notificationService = new NotificationService(
  notificationRepository,
  invitationRepository,
);
export const boardService = new BoardService(boardRepository, projectRepository, userRepository);
export const commentService = new CommentService(
  commentRepository,
  taskRepository,
  activityRepository,
);
export const subtaskService = new SubtaskService(subtaskRepository, taskRepository);
export const projectService = new ProjectService(projectRepository, workspaceRepository);
export const invitationService = new InvitationService({
  invitationRepository,
  workspaceRepository,
  userRepository,
  notificationRepository,
  emailService,
});
export const workspaceService = new WorkspaceService(workspaceRepository, userRepository);
export const searchService = new SearchService(searchRepository);
export const taskService = new TaskService({
  taskRepository,
  boardRepository,
  activityRepository,
  notificationService,
  uploadService,
  eventBroadcaster: sseBroadcaster,
});
export const authService = new AuthService({
  userRepository,
  refreshTokenRepository,
  emailVerificationRepository,
  passwordResetRepository,
  twoFactorCodeRepository,
  emailService,
  tokenService,
  passwordHasher,
});

// ---- Controllers (depend on services) ----
import { AuthController } from './controllers/auth.controller';
import { BoardController } from './controllers/board.controller';
import { CommentController } from './controllers/comment.controller';
import { InvitationController } from './controllers/invitation.controller';
import { NotificationController } from './controllers/notification.controller';
import { ProjectController } from './controllers/project.controller';
import { SearchController } from './controllers/search.controller';
import { SubtaskController } from './controllers/subtask.controller';
import { TaskController } from './controllers/task.controller';
import { WorkspaceController } from './controllers/workspace.controller';

export const authController = new AuthController(authService);
export const boardController = new BoardController(boardService);
export const commentController = new CommentController(commentService);
export const invitationController = new InvitationController(invitationService);
export const notificationController = new NotificationController(notificationService);
export const projectController = new ProjectController(projectService);
export const searchController = new SearchController(searchService);
export const subtaskController = new SubtaskController(subtaskService);
export const taskController = new TaskController(taskService, uploadService);
export const workspaceController = new WorkspaceController(workspaceService, invitationService);
