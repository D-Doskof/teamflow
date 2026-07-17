'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/project.api';

export const projectKeys = {
  all: (workspaceSlug: string) => ['projects', workspaceSlug] as const,
  detail: (workspaceSlug: string, projectId: string) =>
    ['projects', workspaceSlug, projectId] as const,
  labels: (workspaceSlug: string, projectId: string) =>
    ['labels', workspaceSlug, projectId] as const,
};

export function useProjects(workspaceSlug: string) {
  return useQuery({
    queryKey: projectKeys.all(workspaceSlug),
    queryFn: () => projectApi.getByWorkspace(workspaceSlug),
    enabled: !!workspaceSlug,
  });
}

export function useProject(workspaceSlug: string, projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(workspaceSlug, projectId),
    queryFn: () => projectApi.getById(workspaceSlug, projectId),
    enabled: !!workspaceSlug && !!projectId,
  });
}

export function useCreateProject(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string }) =>
      projectApi.create(workspaceSlug, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all(workspaceSlug) }),
  });
}

export function useProjectLabels(workspaceSlug: string, projectId: string) {
  return useQuery({
    queryKey: projectKeys.labels(workspaceSlug, projectId),
    queryFn: () => projectApi.getLabels(workspaceSlug, projectId),
    enabled: !!workspaceSlug && !!projectId,
  });
}

export function useCreateLabel(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      projectApi.createLabel(workspaceSlug, projectId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.labels(workspaceSlug, projectId) }),
  });
}

export function useUpdateLabel(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, data }: { labelId: string; data: { name?: string; color?: string } }) =>
      projectApi.updateLabel(workspaceSlug, projectId, labelId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.labels(workspaceSlug, projectId) }),
  });
}

export function useDeleteLabel(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => projectApi.deleteLabel(workspaceSlug, projectId, labelId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.labels(workspaceSlug, projectId) }),
  });
}
