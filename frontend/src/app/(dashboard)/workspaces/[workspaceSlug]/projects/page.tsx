'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, FolderKanban } from 'lucide-react';
import { useProjects } from '@/features/project/hooks/useProject';
import { CreateProjectModal } from '@/features/project/components/CreateProjectModal';
import { Button } from '@/components/ui/Button';
import { ProjectCardSkeleton } from '@/components/ui/Skeleton';
import { useT } from '@/lib/i18n/useT';

export default function ProjectsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: projects, isLoading } = useProjects(workspaceSlug);
  const [createOpen, setCreateOpen] = useState(false);
  const t = useT();

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.projects.title}</h1>
          <p className="text-muted-foreground mt-1">{t.projects.subtitle}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t.projects.new}
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      )}
      {!isLoading && !projects?.length ? (
        <div className="card p-12 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t.projects.empty.title}</h3>
          <p className="text-muted-foreground mb-6">{t.projects.empty.subtitle}</p>
          <Button onClick={() => setCreateOpen(true)}>{t.projects.empty.action}</Button>
        </div>
      ) : !isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects ?? []).map((project) => (
            <Link
              key={project.id}
              href={`/workspaces/${workspaceSlug}/projects/${project.id}`}
              className="card p-6 hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: project.color ?? '#6366f1' }}
                >
                  {project.icon ?? project.name[0].toUpperCase()}
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary">
                  {project.name}
                </h3>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {project.description}
                </p>
              )}
              {project._count && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    {project._count.boards} {t.projects.boards}
                  </span>
                  <span>
                    {project._count.members} {t.projects.members}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : null}

      <CreateProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
