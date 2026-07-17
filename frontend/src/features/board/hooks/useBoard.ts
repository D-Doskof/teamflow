'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boardApi } from '../api/board.api';

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };

export const boardKeys = {
  all: (workspaceSlug: string, projectId: string) => ['boards', workspaceSlug, projectId] as const,
  detail: (workspaceSlug: string, projectId: string, boardId: string) =>
    ['boards', workspaceSlug, projectId, boardId] as const,
};

export function useBoards(workspaceSlug: string, projectId: string) {
  return useQuery({
    queryKey: boardKeys.all(workspaceSlug, projectId),
    queryFn: () => boardApi.getByProject(workspaceSlug, projectId),
    enabled: !!workspaceSlug && !!projectId,
  });
}

export function useBoard(workspaceSlug: string, projectId: string, boardId: string) {
  return useQuery({
    queryKey: boardKeys.detail(workspaceSlug, projectId, boardId),
    queryFn: () => boardApi.getById(workspaceSlug, projectId, boardId),
    enabled: !!workspaceSlug && !!projectId && !!boardId,
  });
}

export function useCreateBoard(workspaceSlug: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      boardApi.create(workspaceSlug, projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all(workspaceSlug, projectId) }),
  });
}

export function useCreateList(boardPath: BoardPath) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => boardApi.createList(boardPath, data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: boardKeys.detail(boardPath.workspaceSlug, boardPath.projectId, boardPath.boardId),
      }),
  });
}

export function useUpdateList(boardPath: BoardPath) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, ...data }: { listId: string; name?: string; position?: number }) =>
      boardApi.updateList(boardPath, listId, data),
    onSettled: () =>
      qc.refetchQueries({
        queryKey: boardKeys.detail(boardPath.workspaceSlug, boardPath.projectId, boardPath.boardId),
      }),
  });
}

export function useDeleteList(boardPath: BoardPath) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => boardApi.deleteList(boardPath, listId),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: boardKeys.detail(boardPath.workspaceSlug, boardPath.projectId, boardPath.boardId),
      }),
  });
}
