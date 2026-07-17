'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '../api/task.api';

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };

export const taskKeys = {
  board: (path: BoardPath) => ['tasks', path.workspaceSlug, path.projectId, path.boardId] as const,
  detail: (path: BoardPath, taskId: string) =>
    ['tasks', path.workspaceSlug, path.projectId, path.boardId, taskId] as const,
  comments: (path: BoardPath, taskId: string) =>
    ['comments', path.workspaceSlug, path.projectId, path.boardId, taskId] as const,
  activity: (path: BoardPath, taskId: string) =>
    ['activity', path.workspaceSlug, path.projectId, path.boardId, taskId] as const,
  subtasks: (path: BoardPath, taskId: string) =>
    ['subtasks', path.workspaceSlug, path.projectId, path.boardId, taskId] as const,
  attachments: (path: BoardPath, taskId: string) =>
    ['attachments', path.workspaceSlug, path.projectId, path.boardId, taskId] as const,
};

export function useBoardTasks(path: BoardPath, filters?: Record<string, unknown>) {
  const hasFilters = filters && Object.keys(filters).length > 0;
  return useQuery({
    // Without filters: key = taskKeys.board(path) — matches the prefetch key exactly.
    // With filters: key includes the filters object for cache isolation.
    queryKey: hasFilters ? [...taskKeys.board(path), filters] : taskKeys.board(path),
    queryFn: () => taskApi.getByBoard(path, filters as never),
    enabled: !!path.boardId,
  });
}

export function useTask(path: BoardPath, taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(path, taskId),
    queryFn: () => taskApi.getById(path, taskId),
    enabled: !!taskId,
  });
}

export function useCreateTask(path: BoardPath) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskListId,
      data,
    }: {
      taskListId: string;
      data: { title: string; description?: string; priority?: string };
    }) => taskApi.create(path, taskListId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.board(path) }),
  });
}

export function useUpdateTask(path: BoardPath) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: Parameters<typeof taskApi.update>[2];
    }) => taskApi.update(path, taskId, data),
    onMutate: async () => {
      // cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: taskKeys.board(path) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.board(path) }),
  });
}

export function useDeleteTask(path: BoardPath) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => taskApi.delete(path, taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.board(path) }),
  });
}

export function useTaskComments(path: BoardPath, taskId: string) {
  return useQuery({
    queryKey: taskKeys.comments(path, taskId),
    queryFn: () => taskApi.getComments(path, taskId),
    enabled: !!taskId,
  });
}

export function useAddComment(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => taskApi.addComment(path, taskId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.comments(path, taskId) }),
  });
}

export function useDeleteComment(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => taskApi.deleteComment(path, taskId, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.comments(path, taskId) }),
  });
}

export function useAddAssignee(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => taskApi.addAssignee(path, taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
    },
  });
}

export function useRemoveAssignee(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => taskApi.removeAssignee(path, taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
    },
  });
}

export function useAddLabel(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => taskApi.addLabel(path, taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(path, taskId) });
    },
  });
}

export function useRemoveLabel(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => taskApi.removeLabel(path, taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
      queryClient.invalidateQueries({ queryKey: taskKeys.activity(path, taskId) });
    },
  });
}

export function useTaskActivity(path: BoardPath, taskId: string) {
  return useQuery({
    queryKey: taskKeys.activity(path, taskId),
    queryFn: () => taskApi.getActivity(path, taskId),
    enabled: !!taskId,
  });
}

export function useSubtasks(path: BoardPath, taskId: string) {
  return useQuery({
    queryKey: taskKeys.subtasks(path, taskId),
    queryFn: () => taskApi.getSubtasks(path, taskId),
    enabled: !!taskId,
  });
}

export function useCreateSubtask(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => taskApi.createSubtask(path, taskId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.subtasks(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
    },
  });
}

export function useUpdateSubtask(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subtaskId,
      data,
    }: {
      subtaskId: string;
      data: { title?: string; completed?: boolean };
    }) => taskApi.updateSubtask(path, taskId, subtaskId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.subtasks(path, taskId) }),
  });
}

export function useDeleteSubtask(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) => taskApi.deleteSubtask(path, taskId, subtaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.subtasks(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
    },
  });
}

export function useAttachments(path: BoardPath, taskId: string) {
  return useQuery({
    queryKey: taskKeys.attachments(path, taskId),
    queryFn: () => taskApi.getAttachments(path, taskId),
    enabled: !!taskId,
  });
}

export function useUploadAttachment(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => taskApi.uploadAttachment(path, taskId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.attachments(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
    },
  });
}

export function useDeleteAttachment(path: BoardPath, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => taskApi.deleteAttachment(path, taskId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.attachments(path, taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
    },
  });
}
