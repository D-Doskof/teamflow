/**
 * TeamFlow Mock API Server
 * Full in-memory simulation of the backend for frontend development without Docker/PostgreSQL.
 * Usage: node E:\teamflow\mock-server.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from backend
try {
  const envPath = resolve(__dirname, 'backend/.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const require = createRequire(import.meta.url);
const express = require('./backend/node_modules/express');
const cors = require('./backend/node_modules/cors');
const nodemailer = require('./backend/node_modules/nodemailer');

// Email transporter (uses SMTP from .env if configured)
function createMailTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '587', 10),
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendVerificationEmail(to, name, code) {
  const FROM = process.env.SMTP_FROM ?? `TeamFlow <${process.env.SMTP_USER}>`;
  const transport = createMailTransport();
  if (!transport) {
    console.log(`\n[TeamFlow] SMTP not configured — code for ${to}: ${code}\n`);
    return;
  }
  try {
    await transport.sendMail({
      from: FROM,
      to,
      subject: 'Подтверждение email — TeamFlow',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#4f46e5;margin-bottom:8px">TeamFlow</h2>
          <p style="color:#374151">Привет, <strong>${name}</strong>!</p>
          <p style="color:#374151">Введи этот код на сайте, чтобы подтвердить свой email:</p>
          <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827">${code}</span>
          </div>
          <p style="color:#6b7280;font-size:14px">Код действителен 15 минут.</p>
        </div>
      `,
    });
    console.log(`[TeamFlow] Verification email sent to ${to}`);
  } catch (err) {
    console.error(`[TeamFlow] Failed to send email to ${to}:`, err.message);
    console.log(`[TeamFlow] Fallback — code for ${to}: ${code}`);
  }
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Allow any local origin for development (localhost / 192.168.x.x / 10.x.x.x)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin / non-browser
    const local = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
    callback(local ? null : new Error('CORS: origin not allowed'), local);
  },
  credentials: false,
}));

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Rate limiting (120 req/min per IP) ───────────────────────────────────────
const rateLimits = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const t = Date.now();
  const entry = rateLimits.get(ip) || { count: 0, resetAt: t + 60_000 };
  if (t > entry.resetAt) { entry.count = 0; entry.resetAt = t + 60_000; }
  entry.count++;
  rateLimits.set(ip, entry);
  if (entry.count > 120) return res.status(429).json({ success: false, message: 'Too many requests. Please slow down.' });
  next();
});

// ── In-memory store ──────────────────────────────────────────────────────────

let db = {
  users: [
    { id: 'user-1', email: 'test@test.com', password: 'password123', name: 'Test User', avatar: null, bio: 'Frontend tester', isEmailVerified: true, twoFactorEnabled: false, createdAt: new Date().toISOString() },
    { id: 'user-2', email: 'alice@test.com', password: 'password123', name: 'Alice Smith', avatar: null, bio: null, isEmailVerified: true, twoFactorEnabled: false, createdAt: new Date().toISOString() },
  ],
  verificationCodes: [],   // { userId, code, expiresAt }
  pendingTwoFactor: [],    // { token, userId, code, expiresAt }
  workspaces: [
    { id: 'ws-1', name: 'My Workspace', slug: 'my-workspace', description: 'Main workspace for testing', logo: null, createdAt: new Date().toISOString() },
  ],
  workspaceMembers: [
    { id: 'wm-1', workspaceId: 'ws-1', userId: 'user-1', role: 'OWNER', customPermissions: null },
  ],
  invitations: [],
  projects: [
    { id: 'proj-1', workspaceId: 'ws-1', name: 'Demo Project', description: 'A sample project to explore TeamFlow', icon: null, color: '#6366f1', isArchived: false, createdAt: new Date().toISOString() },
  ],
  projectMembers: [
    { id: 'pm-1', projectId: 'proj-1', userId: 'user-1', role: 'OWNER' },
  ],
  labels: [
    { id: 'label-1', projectId: 'proj-1', name: 'Bug', color: '#ef4444' },
    { id: 'label-2', projectId: 'proj-1', name: 'Feature', color: '#8b5cf6' },
    { id: 'label-3', projectId: 'proj-1', name: 'Documentation', color: '#3b82f6' },
    { id: 'label-4', projectId: 'proj-1', name: 'Enhancement', color: '#10b981' },
  ],
  boards: [
    {
      id: 'board-1', projectId: 'proj-1', name: 'Main Board', description: 'Sprint board', position: 0, createdAt: new Date().toISOString(),
      taskLists: [
        { id: 'list-1', boardId: 'board-1', name: 'To Do', position: 0, color: null },
        { id: 'list-2', boardId: 'board-1', name: 'In Progress', position: 1, color: '#3b82f6' },
        { id: 'list-3', boardId: 'board-1', name: 'Done', position: 2, color: '#22c55e' },
      ],
    },
    {
      id: 'board-2', projectId: 'proj-1', name: 'Backlog', description: 'Future tasks and ideas', position: 1, createdAt: new Date().toISOString(),
      taskLists: [
        { id: 'list-4', boardId: 'board-2', name: 'Ideas', position: 0, color: null },
        { id: 'list-5', boardId: 'board-2', name: 'Planned', position: 1, color: '#a78bfa' },
      ],
    },
  ],
  tasks: [
    { id: 'task-1', taskListId: 'list-1', title: 'Set up project structure', description: 'Initialize the repo and set up the base structure.', priority: 'HIGH', status: 'TODO', position: 0, dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), assignees: [], labels: [{ id: 'tl-1', label: { id: 'label-1', name: 'Bug', color: '#ef4444' } }], _count: { comments: 1, attachments: 0, subtasks: 2 }, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date().toISOString() },
    { id: 'task-2', taskListId: 'list-2', title: 'Design database schema', description: null, priority: 'MEDIUM', status: 'IN_PROGRESS', position: 0, dueDate: new Date(Date.now() + 86400000).toISOString(), assignees: [{ id: 'ta-1', user: { id: 'user-1', name: 'Test User', avatar: null } }], labels: [{ id: 'tl-2', label: { id: 'label-2', name: 'Feature', color: '#8b5cf6' } }], _count: { comments: 0, attachments: 0, subtasks: 0 }, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date().toISOString() },
    { id: 'task-3', taskListId: 'list-3', title: 'Write project README', description: 'Document setup instructions and architecture.', priority: 'LOW', status: 'DONE', position: 0, dueDate: new Date(Date.now() - 86400000 * 2).toISOString(), assignees: [], labels: [{ id: 'tl-3', label: { id: 'label-3', name: 'Documentation', color: '#3b82f6' } }], _count: { comments: 3, attachments: 0, subtasks: 0 }, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
    { id: 'task-4', taskListId: 'list-4', title: 'Add OAuth login', description: 'Support Google and GitHub login.', priority: 'MEDIUM', status: 'TODO', position: 0, dueDate: null, assignees: [], labels: [{ id: 'tl-4', label: { id: 'label-2', name: 'Feature', color: '#8b5cf6' } }], _count: { comments: 0, attachments: 0, subtasks: 0 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  comments: [
    { id: 'c-1', taskId: 'task-1', content: 'Started looking into this.', createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(), author: { id: 'user-1', name: 'Test User', avatar: null } },
  ],
  activities: [
    { id: 'act-1', taskId: 'task-1', userId: 'user-1', action: 'created', field: null, oldValue: null, newValue: null, createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: 'act-2', taskId: 'task-1', userId: 'user-1', action: 'changed_priority', field: 'priority', oldValue: 'MEDIUM', newValue: 'HIGH', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'act-3', taskId: 'task-2', userId: 'user-1', action: 'created', field: null, oldValue: null, newValue: null, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'act-4', taskId: 'task-2', userId: 'user-1', action: 'added_assignee', field: 'assignee', oldValue: null, newValue: 'Test User', createdAt: new Date(Date.now() - 86400000).toISOString() },
  ],
  notifications: [
    { id: 'notif-1', userId: 'user-1', type: 'SYSTEM', title: 'Welcome to TeamFlow!', message: 'Your account is ready. Create a workspace to get started.', isRead: false, data: null, createdAt: new Date().toISOString() },
    { id: 'notif-2', userId: 'user-1', type: 'TASK', title: 'Task assigned', message: 'You were assigned to "Design database schema".', isRead: true, data: null, createdAt: new Date(Date.now() - 7200000).toISOString() },
  ],
  subtasks: [
    { id: 'st-1', taskId: 'task-1', title: 'Research existing solutions', completed: true, position: 0, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'st-2', taskId: 'task-1', title: 'Write implementation plan', completed: false, position: 1, createdAt: new Date(Date.now() - 43200000).toISOString() },
  ],
  attachments: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ok = (res, data, message = 'Success', meta) =>
  res.json({ success: true, message, data, ...(meta ? { meta } : {}) });
const err = (res, status, message) =>
  res.status(status).json({ success: false, message });
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const makeToken = (userId) => `mock_${userId}_${Date.now()}`;

// Strip HTML tags, trim, enforce max length — prevents stored XSS
const sanitize = (value, { maxLength = 5000 } = {}) => {
  if (typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
};

const ROLE_DEFAULTS = {
  OWNER:  { canEditContent: true,  canDeleteContent: true,  canManageMembers: true,  canManageAdmins: true,  canComment: true  },
  ADMIN:  { canEditContent: true,  canDeleteContent: true,  canManageMembers: true,  canManageAdmins: false, canComment: true  },
  MEMBER: { canEditContent: true,  canDeleteContent: false, canManageMembers: false, canManageAdmins: false, canComment: true  },
  VIEWER: { canEditContent: false, canDeleteContent: false, canManageMembers: false, canManageAdmins: false, canComment: false },
};

function getPermissions(member) {
  const defaults = ROLE_DEFAULTS[member.role] || ROLE_DEFAULTS.VIEWER;
  return { ...defaults, ...(member.customPermissions || {}) };
}

function getUserId(req) {
  const header = req.headers.authorization || '';
  return header.split('_')[1] || null;
}

function logActivity(taskId, userId, action, field, oldValue, newValue) {
  db.activities.push({ id: uid(), taskId, userId, action, field: field || null, oldValue: oldValue || null, newValue: newValue || null, createdAt: now() });
}

function getMembership(wsId, userId) {
  return db.workspaceMembers.find((m) => m.workspaceId === wsId && m.userId === userId) || null;
}

function checkMember(req, res, wsSlug, { requireEditor = false } = {}) {
  const userId = getUserId(req);
  const ws = db.workspaces.find((w) => w.slug === wsSlug);
  if (!ws) { err(res, 404, 'Workspace not found'); return null; }
  const m = getMembership(ws.id, userId);
  if (!m) { err(res, 403, 'You are not a member of this workspace'); return null; }
  if (requireEditor && !getPermissions(m).canEditContent) { err(res, 403, 'You do not have permission to make changes'); return null; }
  return m;
}

// ── SSE (Server-Sent Events) ─────────────────────────────────────────────────

const sseClients = new Map(); // clientId → res

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, res] of sseClients) {
    try { res.write(msg); } catch {}
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function auth(req, res, next) {
  // Accept token via Authorization header OR ?token= query param (for EventSource)
  const header = req.headers.authorization;
  const queryToken = req.query?.token;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
  if (!token?.startsWith('mock_')) return err(res, 401, 'Unauthorized');
  next();
}

// Broadcast board/task changes after successful mutating requests
app.use((req, res, next) => {
  if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const m = req.path.match(/^\/api\/v1\/workspaces\/([^/]+)\/projects\/([^/]+)\/boards\/([^/]+)/);
    if (!m) return;
    const [, workspaceSlug, projectId, boardId] = m;
    const taskMatch = req.path.match(/\/tasks\/([^/]+)/);
    const taskId = taskMatch?.[1];
    broadcast('board:change', { workspaceSlug, projectId, boardId, taskId: taskId ?? null });
  });
  next();
});

// SSE endpoint — clients subscribe here for live updates
app.get('/api/v1/events', auth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = uid();
  sseClients.set(clientId, res);

  // Initial ping so client knows connection is live
  res.write('event: ping\ndata: {}\n\n');

  // Keep-alive heartbeat every 25s
  const hb = setInterval(() => {
    try { res.write('event: ping\ndata: {}\n\n'); } catch {}
  }, 25_000);

  req.on('close', () => { clearInterval(hb); sseClients.delete(clientId); });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/v1/auth/register', (req, res) => {
  const email = sanitize(req.body.email, { maxLength: 254 });
  const name = sanitize(req.body.name, { maxLength: 100 });
  const password = typeof req.body.password === 'string' ? req.body.password.slice(0, 128) : '';
  if (!email || !name || !password) return err(res, 400, 'Missing fields');
  if (db.users.find((u) => u.email === email)) return err(res, 409, 'Email already in use');
  const user = { id: uid(), email, name, password, avatar: null, bio: null, isEmailVerified: false, twoFactorEnabled: false, createdAt: now() };
  db.users.push(user);
  // auto-create personal workspace
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + uid();
  const ws = { id: uid(), name: `${name}'s Workspace`, slug, description: null, logo: null, createdAt: now() };
  db.workspaces.push(ws);
  db.workspaceMembers.push({ id: uid(), workspaceId: ws.id, userId: user.id, role: 'OWNER', customPermissions: null });
  db.notifications.push({ id: uid(), userId: user.id, type: 'SYSTEM', title: 'Welcome to TeamFlow!', message: 'Your workspace is ready. Invite teammates from the Members page.', isRead: false, data: null, createdAt: now() });
  // generate verification code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.verificationCodes = db.verificationCodes.filter((c) => c.userId !== user.id);
  db.verificationCodes.push({ userId: user.id, code, expiresAt: Date.now() + 15 * 60 * 1000 });
  sendVerificationEmail(email, name, code);
  const { password: _, ...safeUser } = user;
  return ok(res, { user: safeUser, tokens: { accessToken: makeToken(user.id), refreshToken: makeToken(user.id) } });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find((u) => u.email === email);
  if (!user || user.password !== password) return err(res, 401, 'Invalid credentials');

  if (user.twoFactorEnabled) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const twoFactorToken = 'tf_' + uid();
    db.pendingTwoFactor = db.pendingTwoFactor.filter((p) => p.userId !== user.id);
    db.pendingTwoFactor.push({ token: twoFactorToken, userId: user.id, code, expiresAt: Date.now() + 10 * 60 * 1000 });
    sendVerificationEmail(user.email, user.name, code);
    return ok(res, { requiresTwoFactor: true, twoFactorToken, email: user.email.replace(/(.{2}).+(@.+)/, '$1***$2') });
  }

  const { password: _, ...safeUser } = user;
  return ok(res, { user: safeUser, tokens: { accessToken: makeToken(user.id), refreshToken: makeToken(user.id) } });
});

app.post('/api/v1/auth/two-factor', (req, res) => {
  const { twoFactorToken, code } = req.body;
  const entry = db.pendingTwoFactor.find((p) => p.token === twoFactorToken && p.code === code && p.expiresAt > Date.now());
  if (!entry) return err(res, 401, 'Неверный или истёкший код');
  db.pendingTwoFactor = db.pendingTwoFactor.filter((p) => p.token !== twoFactorToken);
  const user = db.users.find((u) => u.id === entry.userId);
  const { password: _, ...safeUser } = user;
  return ok(res, { user: safeUser, tokens: { accessToken: makeToken(user.id), refreshToken: makeToken(user.id) } });
});

app.patch('/api/v1/auth/two-factor', auth, (req, res) => {
  const userId = getUserId(req);
  const { enabled } = req.body;
  const user = db.users.find((u) => u.id === userId);
  if (!user) return err(res, 404, 'User not found');
  user.twoFactorEnabled = !!enabled;
  const { password: _, ...safeUser } = user;
  return ok(res, safeUser);
});

app.post('/api/v1/auth/verify-email', auth, (req, res) => {
  const { code } = req.body;
  const userId = getUserId(req);
  const entry = db.verificationCodes.find((c) => c.userId === userId && c.code === code && c.expiresAt > Date.now());
  if (!entry) return err(res, 400, 'Неверный или истёкший код');
  const user = db.users.find((u) => u.id === userId);
  user.isEmailVerified = true;
  db.verificationCodes = db.verificationCodes.filter((c) => c.userId !== userId);
  const { password: _, ...safeUser } = user;
  return ok(res, { user: safeUser });
});

app.post('/api/v1/auth/resend-verification', auth, (req, res) => {
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId);
  if (!user) return err(res, 404, 'User not found');
  if (user.isEmailVerified) return err(res, 400, 'Email уже подтверждён');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.verificationCodes = db.verificationCodes.filter((c) => c.userId !== userId);
  db.verificationCodes.push({ userId, code, expiresAt: Date.now() + 15 * 60 * 1000 });
  sendVerificationEmail(user.email, user.name, code);
  return res.status(204).send();
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken?.startsWith('mock_')) return err(res, 401, 'Invalid token');
  const userId = refreshToken.split('_')[1];
  const user = db.users.find((u) => u.id === userId);
  if (!user) return err(res, 401, 'User not found');
  const { password: _, ...safeUser } = user;
  return ok(res, { user: safeUser, tokens: { accessToken: makeToken(userId), refreshToken: makeToken(userId) } });
});

app.post('/api/v1/auth/logout', auth, (req, res) => ok(res, null, 'Logged out'));

app.patch('/api/v1/auth/profile', auth, (req, res) => {
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId);
  if (!user) return err(res, 404, 'User not found');
  const { name, bio } = req.body;
  if (name) user.name = sanitize(name, { maxLength: 100 });
  if (bio !== undefined) user.bio = bio ? sanitize(bio, { maxLength: 500 }) : null;
  const { password: _, ...safeUser } = user;
  return ok(res, safeUser);
});

app.patch('/api/v1/auth/password', auth, (req, res) => {
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.password !== req.body.currentPassword) return err(res, 400, 'Incorrect current password');
  user.password = req.body.newPassword;
  return ok(res, null, 'Password updated');
});

app.post('/api/v1/auth/avatar', auth, (req, res) => {
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId);
  if (!user) return err(res, 404, 'User not found');
  const { avatar } = req.body;
  if (!avatar) return err(res, 400, 'Avatar is required');
  user.avatar = avatar;
  // update avatar in all related structures
  db.tasks.forEach((t) => {
    t.assignees.forEach((a) => { if (a.user.id === userId) a.user.avatar = avatar; });
  });
  db.comments.forEach((c) => { if (c.author.id === userId) c.author.avatar = avatar; });
  const { password: _, ...safeUser } = user;
  return ok(res, safeUser, 'Avatar updated');
});

// ── Workspaces ───────────────────────────────────────────────────────────────

// Only return workspaces the current user is a member of
app.get('/api/v1/workspaces', auth, (req, res) => {
  const userId = getUserId(req);
  const memberWsIds = new Set(db.workspaceMembers.filter((m) => m.userId === userId).map((m) => m.workspaceId));
  const result = db.workspaces.filter((ws) => memberWsIds.has(ws.id)).map((ws) => ({
    ...ws,
    _count: {
      projects: db.projects.filter((p) => p.workspaceId === ws.id).length,
      members: db.workspaceMembers.filter((m) => m.workspaceId === ws.id).length,
    },
  }));
  return ok(res, result);
});

app.post('/api/v1/workspaces', auth, (req, res) => {
  const userId = getUserId(req);
  const name = sanitize(req.body.name, { maxLength: 100 });
  const description = req.body.description ? sanitize(req.body.description, { maxLength: 500 }) : null;
  if (!name) return err(res, 400, 'Name is required');
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + uid();
  const ws = { id: uid(), name, slug, description, logo: null, createdAt: now() };
  db.workspaces.push(ws);
  db.workspaceMembers.push({ id: uid(), workspaceId: ws.id, userId, role: 'OWNER', customPermissions: null });
  return ok(res, { ...ws, _count: { projects: 0, members: 1 } }, 'Workspace created');
});

app.get('/api/v1/workspaces/:slug', auth, (req, res) => {
  const userId = getUserId(req);
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  if (!getMembership(ws.id, userId)) return err(res, 403, 'You are not a member of this workspace');
  return ok(res, { ...ws, _count: { projects: db.projects.filter((p) => p.workspaceId === ws.id).length, members: db.workspaceMembers.filter((m) => m.workspaceId === ws.id).length } });
});

app.patch('/api/v1/workspaces/:slug', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  Object.assign(ws, req.body);
  return ok(res, ws);
});

// Members
app.get('/api/v1/workspaces/:slug/members', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const members = db.workspaceMembers.filter((m) => m.workspaceId === ws.id).map((m) => {
    const u = db.users.find((u) => u.id === m.userId);
    const { password: _, ...safeUser } = u || {};
    return { ...m, user: safeUser, permissions: getPermissions(m) };
  });
  return ok(res, members);
});

app.patch('/api/v1/workspaces/:slug/members/:userId', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const member = db.workspaceMembers.find((m) => m.workspaceId === ws.id && m.userId === req.params.userId);
  if (!member) return err(res, 404, 'Member not found');
  if (member.role === 'OWNER') return err(res, 403, 'Cannot change owner role');
  const { role } = req.body;
  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) return err(res, 400, 'Invalid role');
  member.role = role;
  const u = db.users.find((u) => u.id === member.userId);
  const { password: _, ...safeUser } = u || {};
  return ok(res, { ...member, user: safeUser, permissions: getPermissions(member) });
});

app.patch('/api/v1/workspaces/:slug/members/:userId/permissions', auth, (req, res) => {
  const requesterId = getUserId(req);
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const requester = db.workspaceMembers.find((m) => m.workspaceId === ws.id && m.userId === requesterId);
  if (!requester) return err(res, 403, 'Not a member');
  if (!getPermissions(requester).canManageMembers) return err(res, 403, 'No permission to manage members');
  const member = db.workspaceMembers.find((m) => m.workspaceId === ws.id && m.userId === req.params.userId);
  if (!member) return err(res, 404, 'Member not found');
  if (member.role === 'OWNER') return err(res, 403, 'Cannot modify owner permissions');
  const ALLOWED = ['canEditContent', 'canDeleteContent', 'canManageMembers', 'canManageAdmins', 'canComment'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key] === null ? undefined : !!req.body[key];
  }
  if (req.body.reset) {
    member.customPermissions = null;
  } else {
    member.customPermissions = { ...(member.customPermissions || {}) };
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) { delete member.customPermissions[k]; }
      else { member.customPermissions[k] = v; }
    }
    if (Object.keys(member.customPermissions).length === 0) member.customPermissions = null;
  }
  const u = db.users.find((u) => u.id === member.userId);
  const { password: _, ...safeUser } = u || {};
  return ok(res, { ...member, user: safeUser, permissions: getPermissions(member) });
});

app.delete('/api/v1/workspaces/:slug/members/:userId', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const member = db.workspaceMembers.find((m) => m.workspaceId === ws.id && m.userId === req.params.userId);
  if (!member) return err(res, 404, 'Member not found');
  if (member.role === 'OWNER') return err(res, 403, 'Cannot remove workspace owner');
  db.workspaceMembers = db.workspaceMembers.filter((m) => !(m.workspaceId === ws.id && m.userId === req.params.userId));
  return ok(res, null, 'Member removed');
});

// ── Workspace stats ───────────────────────────────────────────────────────────

app.get('/api/v1/workspaces/:slug/stats', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const projects = db.projects.filter((p) => p.workspaceId === ws.id);
  const boardIds = new Set(db.boards.filter((b) => projects.some((p) => p.id === b.projectId)).map((b) => b.id));
  const allBoards = db.boards.filter((b) => boardIds.has(b.id));
  const listIds = new Set(allBoards.flatMap((b) => b.taskLists.map((tl) => tl.id)));
  const tasks = db.tasks.filter((t) => listIds.has(t.taskListId));
  const now = Date.now();
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'DONE').length;
  const byPriority = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
  const byStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  tasks.forEach((t) => { byPriority[t.priority] = (byPriority[t.priority] || 0) + 1; byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
  const members = db.workspaceMembers.filter((m) => m.workspaceId === ws.id);
  return ok(res, {
    totalTasks: tasks.length,
    doneTasks: byStatus.DONE,
    inProgressTasks: byStatus.IN_PROGRESS + byStatus.IN_REVIEW,
    todoTasks: byStatus.TODO,
    overdueTasks: overdue,
    totalProjects: projects.length,
    totalBoards: allBoards.length,
    totalMembers: members.length,
    byPriority,
    byStatus,
  });
});

// ── Invitations ───────────────────────────────────────────────────────────────

// Send invitation
app.post('/api/v1/workspaces/:slug/invitations', auth, (req, res) => {
  const inviterId = getUserId(req);
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const { email, role = 'MEMBER' } = req.body;
  if (!email) return err(res, 400, 'Email is required');

  // Check if already a member
  const existingUser = db.users.find((u) => u.email === email);
  if (existingUser) {
    const alreadyMember = db.workspaceMembers.find((m) => m.workspaceId === ws.id && m.userId === existingUser.id);
    if (alreadyMember) return err(res, 409, 'User is already a member');
  }

  // Check for existing pending invite
  const existingInv = db.invitations.find((i) => i.workspaceId === ws.id && i.email === email && i.status === 'PENDING');
  if (existingInv) return err(res, 409, 'Invitation already sent');

  const inviter = db.users.find((u) => u.id === inviterId);
  const inv = { id: uid(), workspaceId: ws.id, email, role, status: 'PENDING', invitedBy: inviterId, createdAt: now() };
  db.invitations.push(inv);

  // Create a notification for the invited user if they exist
  if (existingUser) {
    db.notifications.push({
      id: uid(), userId: existingUser.id, type: 'INVITATION',
      title: 'Workspace invitation',
      message: `${inviter?.name || 'Someone'} invited you to join "${ws.name}"`,
      isRead: false,
      data: JSON.stringify({ invitationId: inv.id, workspaceName: ws.name, workspaceSlug: ws.slug }),
      createdAt: now(),
    });
  }

  return ok(res, { ...inv, workspace: { id: ws.id, name: ws.name, slug: ws.slug } }, 'Invitation sent');
});

// List pending invitations for workspace (for members page)
app.get('/api/v1/workspaces/:slug/invitations', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const invs = db.invitations.filter((i) => i.workspaceId === ws.id && i.status === 'PENDING');
  return ok(res, invs);
});

// Get my pending invitations (for notifications/invitations page)
app.get('/api/v1/invitations/pending', auth, (req, res) => {
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId);
  if (!user) return err(res, 404, 'User not found');
  const invs = db.invitations.filter((i) => i.email === user.email && i.status === 'PENDING').map((i) => {
    const ws = db.workspaces.find((w) => w.id === i.workspaceId);
    const inviter = db.users.find((u) => u.id === i.invitedBy);
    return { ...i, workspace: ws ? { id: ws.id, name: ws.name, slug: ws.slug } : null, inviterName: inviter?.name || 'Someone' };
  });
  return ok(res, invs);
});

// Accept invitation
app.post('/api/v1/invitations/:id/accept', auth, (req, res) => {
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId);
  const inv = db.invitations.find((i) => i.id === req.params.id);
  if (!inv || inv.email !== user?.email) return err(res, 404, 'Invitation not found');
  if (inv.status !== 'PENDING') return err(res, 400, 'Invitation already processed');
  inv.status = 'ACCEPTED';
  db.workspaceMembers.push({ id: uid(), workspaceId: inv.workspaceId, userId, role: inv.role, customPermissions: null });
  // mark related notification as read
  db.notifications.filter((n) => n.userId === userId && n.type === 'INVITATION' && n.data?.includes(inv.id)).forEach((n) => (n.isRead = true));
  const ws = db.workspaces.find((w) => w.id === inv.workspaceId);
  return ok(res, { workspaceSlug: ws?.slug }, 'Invitation accepted');
});

// Decline invitation
app.post('/api/v1/invitations/:id/decline', auth, (req, res) => {
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId);
  const inv = db.invitations.find((i) => i.id === req.params.id);
  if (!inv || inv.email !== user?.email) return err(res, 404, 'Invitation not found');
  if (inv.status !== 'PENDING') return err(res, 400, 'Invitation already processed');
  inv.status = 'DECLINED';
  db.notifications.filter((n) => n.userId === userId && n.type === 'INVITATION' && n.data?.includes(inv.id)).forEach((n) => (n.isRead = true));
  return ok(res, null, 'Invitation declined');
});

// Cancel invitation (by workspace admin)
app.delete('/api/v1/workspaces/:slug/invitations/:id', auth, (req, res) => {
  const inv = db.invitations.find((i) => i.id === req.params.id);
  if (!inv) return err(res, 404, 'Invitation not found');
  inv.status = 'CANCELLED';
  return ok(res, null, 'Invitation cancelled');
});

// ── Projects ─────────────────────────────────────────────────────────────────

app.get('/api/v1/workspaces/:slug/projects', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const projects = db.projects.filter((p) => p.workspaceId === ws.id && !p.isArchived).map((p) => ({ ...p, _count: { boards: db.boards.filter((b) => b.projectId === p.id).length, members: db.projectMembers.filter((m) => m.projectId === p.id).length } }));
  return ok(res, projects);
});

app.post('/api/v1/workspaces/:slug/projects', auth, (req, res) => {
  const ws = db.workspaces.find((w) => w.slug === req.params.slug);
  if (!ws) return err(res, 404, 'Workspace not found');
  const { name, description, color } = req.body;
  if (!name) return err(res, 400, 'Name is required');
  const proj = { id: uid(), workspaceId: ws.id, name, description: description || null, icon: null, color: color || '#6366f1', isArchived: false, createdAt: now() };
  db.projects.push(proj);
  return ok(res, { ...proj, _count: { boards: 0, members: 1 } }, 'Project created');
});

app.get('/api/v1/workspaces/:slug/projects/:projectId', auth, (req, res) => {
  const proj = db.projects.find((p) => p.id === req.params.projectId);
  if (!proj) return err(res, 404, 'Project not found');
  return ok(res, { ...proj, _count: { boards: db.boards.filter((b) => b.projectId === proj.id).length, members: db.projectMembers.filter((m) => m.projectId === proj.id).length } });
});

// Labels CRUD
app.get('/api/v1/workspaces/:slug/projects/:projectId/labels', auth, (req, res) => {
  const labels = db.labels.filter((l) => l.projectId === req.params.projectId);
  return ok(res, labels);
});

app.post('/api/v1/workspaces/:slug/projects/:projectId/labels', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const { name, color } = req.body;
  if (!name) return err(res, 400, 'Name is required');
  if (!color) return err(res, 400, 'Color is required');
  const label = { id: uid(), projectId: req.params.projectId, name, color };
  db.labels.push(label);
  return ok(res, label, 'Label created');
});

app.patch('/api/v1/workspaces/:slug/projects/:projectId/labels/:labelId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const label = db.labels.find((l) => l.id === req.params.labelId);
  if (!label) return err(res, 404, 'Label not found');
  if (req.body.name) label.name = req.body.name;
  if (req.body.color) label.color = req.body.color;
  // sync label data inside tasks
  db.tasks.forEach((t) => {
    t.labels.forEach((tl) => { if (tl.label.id === label.id) { tl.label.name = label.name; tl.label.color = label.color; } });
  });
  return ok(res, label);
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/labels/:labelId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const idx = db.labels.findIndex((l) => l.id === req.params.labelId);
  if (idx === -1) return err(res, 404, 'Label not found');
  db.labels.splice(idx, 1);
  db.tasks.forEach((t) => { t.labels = t.labels.filter((tl) => tl.label.id !== req.params.labelId); });
  return ok(res, null, 'Label deleted');
});

// ── Boards ───────────────────────────────────────────────────────────────────

app.get('/api/v1/workspaces/:slug/projects/:projectId/boards', auth, (req, res) => {
  const boards = db.boards.filter((b) => b.projectId === req.params.projectId).map(({ taskLists, ...b }) => b);
  return ok(res, boards);
});

app.post('/api/v1/workspaces/:slug/projects/:projectId/boards', auth, (req, res) => {
  const { name, description } = req.body;
  if (!name) return err(res, 400, 'Name is required');
  const board = {
    id: uid(), projectId: req.params.projectId, name, description: description || null, position: db.boards.length, createdAt: now(),
    taskLists: [
      { id: uid(), boardId: '', name: 'To Do', position: 0, color: null },
      { id: uid(), boardId: '', name: 'In Progress', position: 1, color: '#3b82f6' },
      { id: uid(), boardId: '', name: 'Done', position: 2, color: '#22c55e' },
    ],
  };
  board.taskLists.forEach((tl) => (tl.boardId = board.id));
  db.boards.push(board);
  const { taskLists: _, ...boardOut } = board;
  return ok(res, boardOut, 'Board created');
});

app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId', auth, (req, res) => {
  const board = db.boards.find((b) => b.id === req.params.boardId);
  if (!board) return err(res, 404, 'Board not found');
  return ok(res, board);
});

// ── Task Lists (Columns) ─────────────────────────────────────────────────────

app.post('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/lists', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const board = db.boards.find((b) => b.id === req.params.boardId);
  if (!board) return err(res, 404, 'Board not found');
  const { name } = req.body;
  if (!name) return err(res, 400, 'Name is required');
  const list = { id: uid(), boardId: board.id, name, position: board.taskLists.length, color: null };
  board.taskLists.push(list);
  return ok(res, list, 'Column created');
});

app.patch('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/lists/:listId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const board = db.boards.find((b) => b.id === req.params.boardId);
  if (!board) return err(res, 404, 'Board not found');
  const list = board.taskLists.find((tl) => tl.id === req.params.listId);
  if (!list) return err(res, 404, 'List not found');
  Object.assign(list, req.body);
  return ok(res, list);
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/lists/:listId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const board = db.boards.find((b) => b.id === req.params.boardId);
  if (!board) return err(res, 404, 'Board not found');
  const listIndex = board.taskLists.findIndex((tl) => tl.id === req.params.listId);
  if (listIndex === -1) return err(res, 404, 'List not found');
  board.taskLists.splice(listIndex, 1);
  db.tasks = db.tasks.filter((t) => t.taskListId !== req.params.listId);
  return ok(res, null, 'Column deleted');
});

// ── Tasks ────────────────────────────────────────────────────────────────────

app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks', auth, (req, res) => {
  const board = db.boards.find((b) => b.id === req.params.boardId);
  if (!board) return err(res, 404, 'Board not found');
  const listIds = new Set(board.taskLists.map((tl) => tl.id));
  const tasks = db.tasks.filter((t) => listIds.has(t.taskListId));
  return ok(res, tasks, 'OK', { page: 1, limit: 100, total: tasks.length, totalPages: 1, hasNextPage: false, hasPrevPage: false });
});

app.post('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/list/:listId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const title = sanitize(req.body.title, { maxLength: 500 });
  const description = req.body.description ? sanitize(req.body.description, { maxLength: 10000 }) : null;
  const { priority, dueDate } = req.body;
  if (!title) return err(res, 400, 'Title is required');
  const task = { id: uid(), taskListId: req.params.listId, title, description, priority: priority || 'NONE', status: 'TODO', position: db.tasks.filter((t) => t.taskListId === req.params.listId).length, dueDate: dueDate || null, assignees: [], labels: [], _count: { comments: 0, attachments: 0, subtasks: 0 }, createdAt: now(), updatedAt: now() };
  db.tasks.push(task);
  const userId = getUserId(req);
  logActivity(task.id, userId, 'created', null, null, null);
  return ok(res, task, 'Task created');
});

app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId', auth, (req, res) => {
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  return ok(res, task);
});

app.patch('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  const userId = getUserId(req);
  const trackFields = ['title', 'status', 'priority', 'dueDate', 'description'];
  trackFields.forEach((field) => {
    if (req.body[field] !== undefined && req.body[field] !== task[field]) {
      const action = field === 'title' ? 'changed_title' : field === 'status' ? 'changed_status' : field === 'priority' ? 'changed_priority' : field === 'dueDate' ? 'changed_due_date' : 'changed_description';
      logActivity(task.id, userId, action, field, task[field], req.body[field]);
    }
  });
  Object.assign(task, req.body, { updatedAt: now() });
  return ok(res, task);
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  db.tasks = db.tasks.filter((t) => t.id !== req.params.taskId);
  return ok(res, null, 'Task deleted');
});

// Task assignees
app.post('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/assignees', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  const { userId } = req.body;
  const user = db.users.find((u) => u.id === userId);
  if (!user) return err(res, 404, 'User not found');
  if (task.assignees.find((a) => a.user.id === userId)) return err(res, 409, 'Already assigned');
  const assignee = { id: uid(), user: { id: user.id, name: user.name, avatar: user.avatar } };
  task.assignees.push(assignee);
  logActivity(task.id, getUserId(req), 'added_assignee', 'assignee', null, user.name);
  return ok(res, assignee);
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/assignees/:userId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  const removedAssignee = task.assignees.find((a) => a.user.id === req.params.userId);
  task.assignees = task.assignees.filter((a) => a.user.id !== req.params.userId);
  if (removedAssignee) logActivity(task.id, getUserId(req), 'removed_assignee', 'assignee', removedAssignee.user.name, null);
  return ok(res, null, 'Assignee removed');
});

// Task comments
app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/comments', auth, (req, res) => {
  const comments = db.comments.filter((c) => c.taskId === req.params.taskId);
  return ok(res, comments);
});

app.post('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/comments', auth, (req, res) => {
  const content = sanitize(req.body.content, { maxLength: 5000 });
  if (!content) return err(res, 400, 'Content is required');
  const userId = getUserId(req);
  const user = db.users.find((u) => u.id === userId) || db.users[0];
  const comment = { id: uid(), taskId: req.params.taskId, content, createdAt: now(), updatedAt: now(), author: { id: user.id, name: user.name, avatar: user.avatar } };
  db.comments.push(comment);
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (task) task._count.comments++;
  return ok(res, comment, 'Comment added');
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/comments/:commentId', auth, (req, res) => {
  db.comments = db.comments.filter((c) => c.id !== req.params.commentId);
  return ok(res, null, 'Comment deleted');
});

// Task labels
app.post('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/labels/:labelId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  const label = db.labels.find((l) => l.id === req.params.labelId);
  if (!label) return err(res, 404, 'Label not found');
  if (task.labels.find((tl) => tl.label.id === label.id)) return err(res, 409, 'Label already added');
  const entry = { id: uid(), label: { id: label.id, name: label.name, color: label.color } };
  task.labels.push(entry);
  task.updatedAt = now();
  const userId = getUserId(req);
  logActivity(task.id, userId, 'added_label', 'label', null, label.name);
  return ok(res, task);
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/labels/:labelId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  const label = db.labels.find((l) => l.id === req.params.labelId);
  task.labels = task.labels.filter((tl) => tl.label.id !== req.params.labelId);
  task.updatedAt = now();
  const userId = getUserId(req);
  if (label) logActivity(task.id, userId, 'removed_label', 'label', label.name, null);
  return ok(res, task);
});

// Task activity
app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/activity', auth, (req, res) => {
  const activities = db.activities
    .filter((a) => a.taskId === req.params.taskId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((a) => {
      const user = db.users.find((u) => u.id === a.userId);
      return { ...a, user: user ? { id: user.id, name: user.name, avatar: user.avatar } : null };
    });
  return ok(res, activities);
});

// ── Subtasks ──────────────────────────────────────────────────────────────────

app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/subtasks', auth, (req, res) => {
  const subtasks = db.subtasks.filter((s) => s.taskId === req.params.taskId).sort((a, b) => a.position - b.position);
  return ok(res, subtasks);
});

app.post('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/subtasks', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  const title = sanitize(req.body.title, { maxLength: 500 });
  if (!title) return err(res, 400, 'Title is required');
  const count = db.subtasks.filter((s) => s.taskId === req.params.taskId).length;
  const subtask = { id: uid(), taskId: req.params.taskId, title, completed: false, position: count, createdAt: now() };
  db.subtasks.push(subtask);
  task._count.subtasks = (task._count.subtasks || 0) + 1;
  return ok(res, subtask, 'Subtask created');
});

app.patch('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/subtasks/:subtaskId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const subtask = db.subtasks.find((s) => s.id === req.params.subtaskId);
  if (!subtask) return err(res, 404, 'Subtask not found');
  if (req.body.title !== undefined) subtask.title = sanitize(req.body.title, { maxLength: 500 });
  if (req.body.completed !== undefined) subtask.completed = !!req.body.completed;
  return ok(res, subtask);
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/subtasks/:subtaskId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const idx = db.subtasks.findIndex((s) => s.id === req.params.subtaskId);
  if (idx === -1) return err(res, 404, 'Subtask not found');
  db.subtasks.splice(idx, 1);
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (task && task._count.subtasks > 0) task._count.subtasks--;
  return ok(res, null, 'Subtask deleted');
});

// ── Attachments ───────────────────────────────────────────────────────────────

app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/attachments', auth, (req, res) => {
  const attachments = db.attachments.filter((a) => a.taskId === req.params.taskId).map(({ data, ...a }) => a);
  return ok(res, attachments);
});

app.post('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/attachments', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (!task) return err(res, 404, 'Task not found');
  const { name, mimeType, size, data } = req.body;
  if (!name || !data) return err(res, 400, 'Name and data are required');
  if (size > 10 * 1024 * 1024) return err(res, 400, 'File too large (max 10 MB)');
  const userId = getUserId(req);
  const attachment = { id: uid(), taskId: req.params.taskId, name: sanitize(name, { maxLength: 255 }), mimeType: mimeType || 'application/octet-stream', size: size || 0, data, uploadedBy: userId, createdAt: now() };
  db.attachments.push(attachment);
  task._count.attachments = (task._count.attachments || 0) + 1;
  const { data: _, ...out } = attachment;
  return ok(res, out, 'Attachment uploaded');
});

app.get('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/attachments/:attachmentId', auth, (req, res) => {
  const attachment = db.attachments.find((a) => a.id === req.params.attachmentId);
  if (!attachment) return err(res, 404, 'Attachment not found');
  return ok(res, attachment);
});

app.delete('/api/v1/workspaces/:slug/projects/:projectId/boards/:boardId/tasks/:taskId/attachments/:attachmentId', auth, (req, res) => {
  if (!checkMember(req, res, req.params.slug, { requireEditor: true })) return;
  const idx = db.attachments.findIndex((a) => a.id === req.params.attachmentId);
  if (idx === -1) return err(res, 404, 'Attachment not found');
  db.attachments.splice(idx, 1);
  const task = db.tasks.find((t) => t.id === req.params.taskId);
  if (task && task._count.attachments > 0) task._count.attachments--;
  return ok(res, null, 'Attachment deleted');
});

// ── Search ────────────────────────────────────────────────────────────────────

app.get('/api/v1/search', auth, (req, res) => {
  const userId = getUserId(req);
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return ok(res, { tasks: [], projects: [], boards: [] });

  // Find workspaces user belongs to
  const userWsIds = new Set(db.workspaceMembers.filter((m) => m.userId === userId).map((m) => m.workspaceId));

  // Match projects
  const projects = db.projects.filter((p) => userWsIds.has(p.workspaceId) && !p.isArchived &&
    (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  ).slice(0, 5).map((p) => {
    const ws = db.workspaces.find((w) => w.id === p.workspaceId);
    return { ...p, workspace: ws ? { id: ws.id, name: ws.name, slug: ws.slug } : null };
  });

  // Match boards
  const projectIds = new Set(db.projects.filter((p) => userWsIds.has(p.workspaceId)).map((p) => p.id));
  const boards = db.boards.filter((b) => projectIds.has(b.projectId) &&
    (b.name.toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q))
  ).slice(0, 5).map((b) => {
    const proj = db.projects.find((p) => p.id === b.projectId);
    const ws = proj ? db.workspaces.find((w) => w.id === proj.workspaceId) : null;
    return { id: b.id, name: b.name, projectId: b.projectId, projectName: proj?.name, workspaceSlug: ws?.slug };
  });

  // Find all task list IDs belonging to user's boards
  const boardMap = {};
  db.boards.filter((b) => projectIds.has(b.projectId)).forEach((b) => {
    const proj = db.projects.find((p) => p.id === b.projectId);
    const ws = proj ? db.workspaces.find((w) => w.id === proj.workspaceId) : null;
    b.taskLists.forEach((tl) => { boardMap[tl.id] = { boardId: b.id, projectId: b.projectId, workspaceSlug: ws?.slug, projectName: proj?.name, boardName: b.name }; });
  });

  // Match tasks
  const tasks = db.tasks.filter((t) => {
    const ctx = boardMap[t.taskListId];
    return ctx && (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  }).slice(0, 10).map((t) => {
    const ctx = boardMap[t.taskListId];
    return { id: t.id, title: t.title, priority: t.priority, status: t.status, ...ctx };
  });

  return ok(res, { tasks, projects, boards });
});

// ── Notifications ──────────────────────────────────────────────────────────────

app.get('/api/v1/notifications/unread-count', auth, (req, res) => {
  const userId = getUserId(req);
  const count = db.notifications.filter((n) => n.userId === userId && !n.isRead).length;
  return ok(res, { count });
});

app.get('/api/v1/notifications', auth, (req, res) => {
  const userId = getUserId(req);
  const notifs = db.notifications.filter((n) => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok(res, notifs, 'OK', { page: 1, limit: 20, total: notifs.length, totalPages: 1, hasNextPage: false, hasPrevPage: false });
});

app.patch('/api/v1/notifications/:id/read', auth, (req, res) => {
  const notif = db.notifications.find((n) => n.id === req.params.id);
  if (notif) notif.isRead = true;
  return ok(res, notif);
});

app.post('/api/v1/notifications/mark-all-read', auth, (req, res) => {
  const userId = getUserId(req);
  db.notifications.filter((n) => n.userId === userId).forEach((n) => (n.isRead = true));
  return ok(res, null, 'All marked as read');
});

// ── Start ──────────────────────────────────────────────────────────────────────

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`\n✅ Mock API running at http://localhost:${PORT}/api/v1`);
  console.log('\n📧 Test accounts:');
  console.log('   test@test.com  / password123  (has workspace)');
  console.log('   alice@test.com / password123  (can receive invites)\n');
});
