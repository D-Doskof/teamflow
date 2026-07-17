'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  FolderKanban,
  Kanban,
  Plus,
  Users,
  LayoutDashboard,
  X,
  Settings,
  CalendarDays,
  Building2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { useProjects, projectKeys } from '@/features/project/hooks/useProject';
import { useBoards, boardKeys } from '@/features/board/hooks/useBoard';
import { boardApi } from '@/features/board/api/board.api';
import { useQueryClient } from '@tanstack/react-query';
import { CreateProjectModal } from '@/features/project/components/CreateProjectModal';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

type BoardPath = { workspaceSlug: string; projectId?: string; boardId?: string };

function BoardLinks({
  workspaceSlug,
  projectId,
  currentBoardId,
}: {
  workspaceSlug: string;
  projectId: string;
  currentBoardId?: string;
}) {
  const { data: boards } = useBoards(workspaceSlug, projectId);
  if (!boards?.length) return null;
  return (
    <div className="mt-0.5 ml-3 space-y-0.5">
      {boards.map((board) => (
        <Link
          key={board.id}
          href={`/workspaces/${workspaceSlug}/projects/${projectId}/boards/${board.id}`}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
            currentBoardId === board.id
              ? 'bg-primary/15 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
          )}
        >
          <Kanban className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{board.name}</span>
        </Link>
      ))}
    </div>
  );
}

function SidebarContent({
  workspaceSlug,
  projectId,
  boardId,
  onClose,
  pathname,
}: {
  workspaceSlug: string;
  projectId?: string;
  boardId?: string;
  onClose: () => void;
  pathname?: string;
}) {
  const t = useT();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const { data: workspace } = useWorkspace(workspaceSlug);
  const { data: projects } = useProjects(workspaceSlug);
  const queryClient = useQueryClient();

  const prefetchBoards = (pId: string) => {
    queryClient.prefetchQuery({
      queryKey: boardKeys.all(workspaceSlug, pId),
      queryFn: () => boardApi.getByProject(workspaceSlug, pId),
      staleTime: 30_000,
    });
  };

  return (
    <>
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Link
          href={`/workspaces/${workspaceSlug}/projects`}
          onClick={onClose}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors group flex-1 min-w-0"
        >
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
            {workspace?.name[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="font-semibold text-foreground text-sm truncate flex-1">
            {workspace?.name ?? '...'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
        </Link>
        {/* Close button on mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 p-2 overflow-y-auto flex flex-col">
        <Link
          href={`/workspaces/${workspaceSlug}/dashboard`}
          onClick={onClose}
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
          <span>{t.sidebar.dashboard}</span>
        </Link>

        <Link
          href={`/workspaces/${workspaceSlug}/members`}
          onClick={onClose}
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Users className="h-4 w-4 flex-shrink-0" />
          <span>{t.sidebar.members}</span>
        </Link>

        <Link
          href="/workspaces"
          onClick={onClose}
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors mb-1"
        >
          <Building2 className="h-4 w-4 flex-shrink-0" />
          <span>{t.sidebar.allWorkspaces}</span>
        </Link>

        <div className="flex items-center justify-between px-2 py-1.5 mb-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t.sidebar.projects}
          </span>
          <button
            onClick={() => setCreateProjectOpen(true)}
            className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
            title={t.sidebar.newProject}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="space-y-0.5 flex-1">
          {projects?.map((project) => {
            const isActive = projectId === project.id;
            return (
              <div key={project.id}>
                <Link
                  href={`/workspaces/${workspaceSlug}/projects/${project.id}`}
                  onClick={onClose}
                  onMouseEnter={() => prefetchBoards(project.id)}
                  onTouchStart={() => prefetchBoards(project.id)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-secondary',
                  )}
                >
                  <FolderKanban className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1">{project.name}</span>
                </Link>
                {isActive && (
                  <>
                    <BoardLinks
                      workspaceSlug={workspaceSlug}
                      projectId={project.id}
                      currentBoardId={boardId}
                    />
                    <div className="mt-0.5 ml-3">
                      <Link
                        href={`/workspaces/${workspaceSlug}/projects/${project.id}/calendar`}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                          pathname?.includes('/calendar')
                            ? 'bg-primary/15 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                        )}
                      >
                        <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Calendar</span>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {projects !== undefined && projects.length === 0 && (
            <button
              onClick={() => setCreateProjectOpen(true)}
              className="w-full text-left px-2 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            >
              {t.sidebar.firstProject}
            </button>
          )}
        </nav>
      </div>

      {/* Mobile-only footer: settings, theme, language */}
      <div className="md:hidden flex-shrink-0 border-t border-border p-3 flex items-center gap-2">
        <Link
          href="/settings"
          onClick={onClose}
          className="flex items-center gap-2 flex-1 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          <span>Settings</span>
        </Link>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <CreateProjectModal
        isOpen={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        workspaceSlug={workspaceSlug}
      />
    </>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ workspaceSlug: string; projectId?: string; boardId?: string }>();
  const { workspaceSlug, projectId, boardId } = params;
  const { isOpen, close } = useSidebar();
  const pathname = usePathname();

  // Close sidebar whenever the user navigates to a new page
  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Mobile backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-[4999] md:hidden" onClick={close} />}

      {/* Sidebar: fixed overlay on mobile, static column on desktop */}
      <aside
        className={cn(
          'w-64 bg-card border-r border-border flex-col overflow-y-auto flex-shrink-0',
          // Mobile: hidden by default, slide in as overlay when open
          isOpen ? 'flex fixed top-0 left-0 bottom-0 z-[5000]' : 'hidden',
          // Desktop: always visible as a static column
          'md:flex md:static md:top-auto md:left-auto md:bottom-auto md:z-auto',
        )}
      >
        <SidebarContent
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          boardId={boardId}
          onClose={close}
          pathname={pathname}
        />
      </aside>

      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
