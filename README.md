# TeamFlow

A full-stack project management platform — a Jira/Trello/ClickUp-style hybrid with Kanban boards, workspaces, task management, and real-time team collaboration.

Built as a portfolio project to demonstrate full-stack engineering with a real, production-shaped architecture: layered backend (Clean Architecture), feature-based frontend, real database with migrations, tests, and Docker-based local setup.

![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

## Features

- **Auth** — register/login, email verification, two-factor authentication (email code), password reset, profile & avatar
- **Workspaces & Projects** — multi-tenant workspaces, role-based access (Owner / Admin / Member / Viewer) with per-member permission overrides
- **Boards** — Kanban boards with drag-and-drop, multiple boards per project, custom columns, filters, labels
- **Tasks** — priorities, due dates, assignees, comments, subtasks, file attachments, activity log
- **Real-time** — live board updates via Server-Sent Events
- **Notifications** — in-app notifications, workspace invitations with accept/decline
- **Calendar** — task due-date calendar view with .ics / Google Calendar export
- **i18n** — full English, Russian and Polish translations, switchable instantly
- **Dark / light theme** with customizable accent color
- **Mobile-friendly** — responsive layout, installable as a PWA (Add to Home Screen)

## Tech stack

**Backend** — Node.js, Express, TypeScript, PostgreSQL, Prisma ORM, JWT auth, Vitest
**Frontend** — Next.js 15 (App Router), TypeScript, TailwindCSS, React Query, Zustand, React Hook Form + Zod

Architecture:
- Backend follows **Clean Architecture**: `controllers → services → repositories`, with interfaces/dependency injection wired in a single composition root (`src/container.ts`).
- Frontend is **feature-based**: `src/features/{auth,workspace,project,board,task}/{api,hooks,components,types}`.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose (recommended — runs the whole stack with one command)
- OR, for running without Docker: [Node.js 20+](https://nodejs.org/) and a local [PostgreSQL 16](https://www.postgresql.org/) instance

## Getting started (Docker — recommended)

1. Clone the repo:
   ```bash
   git clone <your-repo-url> teamflow
   cd teamflow
   ```

2. Create the required `.env` files from the provided examples:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
   Open `.env` and set your own `POSTGRES_PASSWORD`. The defaults in `backend/.env` work out of the box for local development — see [Environment variables](#environment-variables) below if you want to customize anything (e.g. real SMTP for emails).

3. Start everything:
   ```bash
   docker-compose up -d --build
   ```
   This builds and starts three containers: PostgreSQL (`5432`), the backend API (`5000`), and the frontend (`3000`). Database migrations are applied automatically on backend startup.

4. Open **http://localhost:3000** and register a new account — the database starts empty, there are no seeded users.

To stop everything: `docker-compose down`. To wipe the database and start fresh: `docker-compose down -v`.

## Getting started (without Docker)

You'll need a local PostgreSQL 16 instance running and reachable.

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # edit DATABASE_URL to point at your local Postgres
npx prisma migrate deploy
npm run dev             # http://localhost:5000
```

**Frontend** (in a separate terminal):
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev             # http://localhost:3000
```

## Environment variables

### `backend/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Secrets used to sign JWTs — **change these to long random strings before any real deployment** |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes |
| `CORS_ORIGIN` | Frontend origin allowed by CORS |
| `SMTP_*` | Optional. If left blank, verification codes / 2FA codes / password-reset links are logged to the backend console instead of being emailed — handy for local development without setting up a real mailbox |
| `BCRYPT_ROUNDS`, `RATE_LIMIT_*` | Security tuning, sane defaults are provided |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL the browser uses to reach the backend API |

## Running tests

```bash
# Backend (Vitest, unit tests against mocked repositories)
cd backend && npm test

# Frontend (Vitest + React Testing Library)
cd frontend && npm test
```

## Project structure

```
teamflow/
├── backend/
│   ├── src/
│   │   ├── controllers/    # HTTP layer
│   │   ├── services/       # business logic
│   │   ├── repositories/   # data access (Prisma)
│   │   ├── middlewares/    # auth, rate limiting, error handling, role guards
│   │   ├── validators/     # Zod schemas
│   │   └── container.ts    # composition root (dependency wiring)
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
└── frontend/
    └── src/
        ├── app/             # Next.js App Router pages
        ├── features/        # feature-sliced modules (api/hooks/components/types)
        ├── components/ui/   # shared UI components
        ├── store/           # Zustand stores
        └── lib/i18n/         # en/ru/pl dictionaries
```

## License

This is a portfolio/educational project. Feel free to use it as a reference or starting point for your own work.
