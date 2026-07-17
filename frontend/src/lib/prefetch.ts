'use client';

import { QueryClient } from '@tanstack/react-query';
import { workspaceKeys } from '@/features/workspace/hooks/useWorkspace';
import { workspaceApi } from '@/features/workspace/api/workspace.api';
import { projectKeys } from '@/features/project/hooks/useProject';
import { projectApi } from '@/features/project/api/project.api';
import { boardKeys } from '@/features/board/hooks/useBoard';
import { boardApi } from '@/features/board/api/board.api';
import { taskKeys } from '@/features/task/hooks/useTask';
import { taskApi } from '@/features/task/api/task.api';

const STALE = 30_000;

type LastBoard = { workspaceSlug: string; projectId: string; boardId: string };

function getLastBoard(): LastBoard | null {
  try {
    const raw = localStorage.getItem('tf:lastBoard');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Cascade prefetch that runs once after auth is confirmed, in priority order:
 * 0. Workspaces list + last-visited board (parallel, immediate)
 * 1. Projects for every workspace (after workspaces resolve)
 * 2. Boards list for the first 2 projects of each workspace
 * 3. Board detail for the first board of the first project (if not already loaded by 0)
 */
export async function warmCache(queryClient: QueryClient) {
  const lastBoard = getLastBoard();

  // Priority 0a: workspaces (needed by everything else)
  const workspacesPromise = queryClient
    .fetchQuery({ queryKey: workspaceKeys.all, queryFn: workspaceApi.getAll, staleTime: STALE })
    .catch(() => [] as Awaited<ReturnType<typeof workspaceApi.getAll>>);

  // Priority 0b: last visited board — start in parallel with workspaces
  if (lastBoard) {
    const { workspaceSlug, projectId, boardId } = lastBoard;
    const path = { workspaceSlug, projectId, boardId };
    Promise.all([
      queryClient.prefetchQuery({
        queryKey: boardKeys.detail(workspaceSlug, projectId, boardId),
        queryFn: () => boardApi.getById(workspaceSlug, projectId, boardId),
        staleTime: STALE,
      }),
      queryClient.prefetchQuery({
        queryKey: taskKeys.board(path),
        queryFn: () => taskApi.getByBoard(path),
        staleTime: STALE,
      }),
    ]);
  }

  // Wait for workspaces before cascading
  const workspaces = await workspacesPromise;
  if (!workspaces.length) return;

  // Priority 1: projects for all workspaces (parallel)
  const projectResults = await Promise.all(
    workspaces.slice(0, 5).map((ws) =>
      queryClient
        .fetchQuery({
          queryKey: projectKeys.all(ws.slug),
          queryFn: () => projectApi.getByWorkspace(ws.slug),
          staleTime: STALE,
        })
        .catch(() => [] as Awaited<ReturnType<typeof projectApi.getByWorkspace>>),
    ),
  );

  // Priority 2: boards list for first 2 projects of each workspace (background)
  const boardsListPromises = workspaces.slice(0, 5).flatMap((ws, i) =>
    (projectResults[i] ?? []).slice(0, 2).map((proj) =>
      queryClient
        .fetchQuery({
          queryKey: boardKeys.all(ws.slug, proj.id),
          queryFn: () => boardApi.getByProject(ws.slug, proj.id),
          staleTime: STALE,
        })
        .catch(() => [] as Awaited<ReturnType<typeof boardApi.getByProject>>),
    ),
  );
  const boardsResults = await Promise.all(boardsListPromises);

  // Priority 3: board detail for the first board of the first project
  // (only if we don't already have the last-visited board in cache)
  if (!lastBoard) {
    const firstWs = workspaces[0];
    const firstProj = projectResults[0]?.[0];
    const firstBoard = boardsResults[0]?.[0];
    if (firstWs && firstProj && firstBoard) {
      const path = { workspaceSlug: firstWs.slug, projectId: firstProj.id, boardId: firstBoard.id };
      Promise.all([
        queryClient.prefetchQuery({
          queryKey: boardKeys.detail(firstWs.slug, firstProj.id, firstBoard.id),
          queryFn: () => boardApi.getById(firstWs.slug, firstProj.id, firstBoard.id),
          staleTime: STALE,
        }),
        queryClient.prefetchQuery({
          queryKey: taskKeys.board(path),
          queryFn: () => taskApi.getByBoard(path),
          staleTime: STALE,
        }),
      ]);
    }
  }
}
