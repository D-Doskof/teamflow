'use client';

import { useState } from 'react';
import { Plus, Building2, FolderOpen, Users, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useWorkspaces, useCreateWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { WorkspaceCardSkeleton } from '@/components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
import { useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/project/hooks/useProject';
import { projectApi } from '@/features/project/api/project.api';

// Per-workspace avatar squares derive a few stable-but-distinct variations from the
// CURRENT accent's own signature gradient via CSS filters, so the palette always stays in
// the active theme's hue family instead of a fixed violet/indigo/blue. Rotation is kept
// small (<=20deg) — several presets sit close to the blue-violet/pink-magenta boundary, and
// a wider swing can rotate their gradient straight into it (verified against all presets;
// the browser's hue-rotate filter doesn't rotate in plain HSL space).
const AVATAR_FILTERS = [
  'none',
  'hue-rotate(14deg) saturate(1.08)',
  'hue-rotate(-14deg) saturate(1.08)',
  'hue-rotate(20deg) brightness(0.95)',
  'hue-rotate(-20deg) brightness(1.08)',
  'saturate(0.75) brightness(1.12)',
];

function getAvatarFilter(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_FILTERS.length;
  return AVATAR_FILTERS[idx];
}

function CreateWorkspaceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useT();
  const createWorkspace = useCreateWorkspace();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ name: string; description?: string }>();

  const onSubmit = (data: { name: string; description?: string }) => {
    createWorkspace.mutate(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.workspaces.modal.title}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t.workspaces.modal.name}
          placeholder={t.workspaces.modal.namePlaceholder}
          error={errors.name?.message}
          {...register('name', { required: t.validation.required })}
        />
        <Input
          label={t.workspaces.modal.desc}
          placeholder={t.workspaces.modal.descPlaceholder}
          {...register('description')}
        />
        {createWorkspace.error && (
          <p className="text-sm text-destructive">{getErrorMessage(createWorkspace.error)}</p>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} type="button">
            {t.common.cancel}
          </Button>
          <Button type="submit" isLoading={createWorkspace.isPending}>
            {t.workspaces.modal.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function WorkspacesPage() {
  const t = useT();
  const { data: workspaces, isLoading } = useWorkspaces();
  const [isModalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const prefetchProjects = (slug: string) => {
    queryClient.prefetchQuery({
      queryKey: projectKeys.all(slug),
      queryFn: () => projectApi.getByWorkspace(slug),
      staleTime: 30_000,
    });
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t.workspaces.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t.workspaces.subtitle}</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            size="sm"
            className="self-start sm:self-auto flex-shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t.workspaces.new}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <WorkspaceCardSkeleton />
            <WorkspaceCardSkeleton />
            <WorkspaceCardSkeleton />
          </div>
        )}
        {!isLoading && !workspaces?.length ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="relative mb-6">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20"
                style={{ backgroundImage: 'var(--gradient-signature)' }}
              >
                <Building2 className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg">
                <Sparkles className="h-4 w-4 text-yellow-800" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t.workspaces.empty.title}</h2>
            <p className="text-muted-foreground mb-8 max-w-sm">{t.workspaces.empty.subtitle}</p>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t.workspaces.empty.action}
            </Button>
          </div>
        ) : !isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(workspaces ?? []).map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.slug}/projects`}
                className="group card p-6 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200"
                onMouseEnter={() => prefetchProjects(ws.slug)}
                onTouchStart={() => prefetchProjects(ws.slug)}
              >
                {/* Workspace header */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm"
                    style={{
                      backgroundImage: 'var(--gradient-signature)',
                      filter: getAvatarFilter(ws.name),
                    }}
                  >
                    {ws.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary truncate transition-colors">
                      {ws.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">/{ws.slug}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
                </div>

                {/* Description */}
                {ws.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {ws.description}
                  </p>
                )}

                {/* Stats */}
                {ws._count && (
                  <div className="flex gap-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {ws._count.projects} {t.workspaces.projects}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {ws._count.members} {t.workspaces.members}
                    </span>
                  </div>
                )}
              </Link>
            ))}

            {/* Create new card */}
            <button
              onClick={() => setModalOpen(true)}
              className="card p-6 border-dashed border-2 border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary min-h-[140px]"
            >
              <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{t.workspaces.new}</span>
            </button>
          </div>
        ) : null}
      </div>

      <CreateWorkspaceModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
