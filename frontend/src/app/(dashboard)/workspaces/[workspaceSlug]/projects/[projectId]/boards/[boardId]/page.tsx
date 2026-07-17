'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Kanban } from 'lucide-react';
import { useBoard, useBoards } from '@/features/board/hooks/useBoard';
import { useBoardTasks } from '@/features/task/hooks/useTask';
import { KanbanBoard } from '@/features/board/components/KanbanBoard';
import { CreateBoardModal } from '@/features/board/components/CreateBoardModal';
import { useMyPermissions } from '@/features/workspace/hooks/useWorkspace';
import { KanbanColumnSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

function BoardTabs({
  workspaceSlug,
  projectId,
  activeBoardId,
}: {
  workspaceSlug: string;
  projectId: string;
  activeBoardId: string;
}) {
  const { data: boards } = useBoards(workspaceSlug, projectId);
  const [createOpen, setCreateOpen] = useState(false);

  if (!boards?.length) return null;

  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto overflow-y-hidden flex-shrink-0 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      {boards.map((board) => (
        <Link
          key={board.id}
          href={`/workspaces/${workspaceSlug}/projects/${projectId}/boards/${board.id}`}
          className={cn(
            'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px',
            board.id === activeBoardId
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
          )}
        >
          <Kanban className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="max-w-[140px] sm:max-w-none truncate">{board.name}</span>
        </Link>
      ))}
      <button
        onClick={() => setCreateOpen(true)}
        className="flex items-center gap-1 px-2.5 py-2.5 text-sm text-muted-foreground hover:text-foreground whitespace-nowrap border-b-2 border-transparent -mb-px transition-colors flex-shrink-0"
        title="Add board"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <CreateBoardModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
      />
    </div>
  );
}

export default function BoardPage() {
  const { workspaceSlug, projectId, boardId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    boardId: string;
  }>();

  // Stable reference so it doesn't defeat memoization (React.memo / useCallback) in
  // KanbanBoard and its children — this page re-renders often as board/task queries settle.
  const boardPath = useMemo(
    () => ({ workspaceSlug, projectId, boardId }),
    [workspaceSlug, projectId, boardId],
  );

  // Remember last visited board so AppPrefetch can warm it on next session start
  useEffect(() => {
    try {
      localStorage.setItem('tf:lastBoard', JSON.stringify({ workspaceSlug, projectId, boardId }));
    } catch {}
  }, [workspaceSlug, projectId, boardId]);

  const { data: board, isLoading: boardLoading } = useBoard(workspaceSlug, projectId, boardId);
  const { data: tasksData, isLoading: tasksLoading } = useBoardTasks(boardPath);
  const perms = useMyPermissions(workspaceSlug);
  const canEdit = perms?.canEditContent ?? false;
  const canDelete = perms?.canDeleteContent ?? false;
  const canComment = perms?.canComment ?? false;

  const boardWithTasks = useMemo(() => {
    if (!board) return undefined;
    const tasks = tasksData?.data ?? [];
    return {
      ...board,
      taskLists: board.taskLists.map((list) => ({
        ...list,
        tasks: tasks
          .filter((t) => t.taskListId === list.id)
          .sort((a, b) => a.position - b.position),
      })),
    };
  }, [board, tasksData]);

  if (boardLoading || tasksLoading || !boardWithTasks) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-3 sm:px-6 pt-2 sm:pt-3 bg-background border-b border-border">
          {/* Skeleton for board tab */}
          <div className="flex items-center gap-2 py-2.5">
            <div className="h-3.5 w-3.5 rounded bg-secondary animate-pulse" />
            <div className="h-4 w-28 rounded bg-secondary animate-pulse" />
          </div>
        </div>
        <div className="flex gap-4 p-3 sm:p-6 overflow-hidden">
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
          <KanbanColumnSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Always-visible header: board tabs (name + switching) */}
      <div className="px-3 sm:px-6 pt-2 sm:pt-3 bg-background border-b border-border">
        <BoardTabs workspaceSlug={workspaceSlug} projectId={projectId} activeBoardId={boardId} />
      </div>
      <div className="flex-1 p-3 sm:p-6 overflow-hidden">
        <KanbanBoard
          board={boardWithTasks}
          boardPath={boardPath}
          canEdit={canEdit}
          canDelete={canDelete}
          canComment={canComment}
        />
      </div>
    </div>
  );
}
