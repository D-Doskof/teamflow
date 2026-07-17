'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace.api';
import { useRouter } from 'next/navigation';
import type { MemberPermissions } from '@/types';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  detail: (slug: string) => ['workspaces', slug] as const,
  members: (slug: string) => ['workspaces', slug, 'members'] as const,
  myPermissions: (slug: string) => ['workspaces', slug, 'me', 'permissions'] as const,
  invitations: (slug: string) => ['workspaces', slug, 'invitations'] as const,
  pendingInvitations: ['invitations', 'pending'] as const,
};

export function useWorkspaceStats(slug: string) {
  return useQuery({
    queryKey: [...workspaceKeys.detail(slug), 'stats'],
    queryFn: () => workspaceApi.getStats(slug),
    enabled: !!slug,
    refetchInterval: 30_000,
  });
}

export function useWorkspaces() {
  return useQuery({ queryKey: workspaceKeys.all, queryFn: workspaceApi.getAll });
}

export function useWorkspace(slug: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(slug),
    queryFn: () => workspaceApi.getBySlug(slug),
    enabled: !!slug,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workspaceApi.create,
    onSuccess: () => qc.refetchQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useWorkspaceMembers(slug: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: workspaceKeys.members(slug),
    queryFn: () => workspaceApi.getMembers(slug),
    enabled: !!slug,
    refetchInterval: 10_000,
    ...options,
  });
}

export function useUpdateMemberRole(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      workspaceApi.updateMemberRole(slug, userId, role),
    onSuccess: () => qc.refetchQueries({ queryKey: workspaceKeys.members(slug) }),
  });
}

export function useRemoveMember(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => workspaceApi.removeMember(slug, userId),
    onSuccess: () => qc.refetchQueries({ queryKey: workspaceKeys.members(slug) }),
  });
}

export function useSendInvitation(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role?: string }) => workspaceApi.sendInvitation(slug, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.invitations(slug) }),
  });
}

export function useWorkspaceInvitations(slug: string) {
  return useQuery({
    queryKey: workspaceKeys.invitations(slug),
    queryFn: () => workspaceApi.getWorkspaceInvitations(slug),
    enabled: !!slug,
    refetchInterval: 15_000,
  });
}

export function useCancelInvitation(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invId: string) => workspaceApi.cancelInvitation(slug, invId),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.invitations(slug) }),
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: workspaceApi.acceptInvitation,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: workspaceKeys.all });
      qc.invalidateQueries({ queryKey: workspaceKeys.pendingInvitations });
      if (data?.workspaceSlug) router.push(`/workspaces/${data.workspaceSlug}/projects`);
    },
  });
}

export function useDeclineInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workspaceApi.declineInvitation,
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.pendingInvitations }),
  });
}

export function useMyPermissions(slug: string): MemberPermissions | null {
  const { data } = useQuery({
    queryKey: workspaceKeys.myPermissions(slug),
    queryFn: () => workspaceApi.getMyPermissions(slug),
    enabled: !!slug,
    refetchInterval: 20_000,
  });
  return data ?? null;
}

export function useUpdateMemberPermissions(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: Partial<MemberPermissions> & { reset?: boolean };
    }) => workspaceApi.updateMemberPermissions(slug, userId, permissions),
    onSettled: () => qc.refetchQueries({ queryKey: workspaceKeys.members(slug) }),
  });
}
