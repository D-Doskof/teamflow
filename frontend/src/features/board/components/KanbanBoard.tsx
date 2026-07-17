'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  DragDropContext,
  Droppable,
  DropResult,
  useMouseSensor,
  useKeyboardSensor,
} from '@hello-pangea/dnd';
import { Plus, Filter, X, ChevronDown, Rows3, Columns3 } from 'lucide-react';
import { Board, Task } from '@/types';
import { TaskColumn } from './TaskColumn';
import { ColumnTabs } from './ColumnTabs';
import { CreateTaskModal } from '@/features/task/components/CreateTaskModal';
import { TaskDetailModal } from '@/features/task/components/TaskDetailModal';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useUpdateTask } from '@/features/task/hooks/useTask';
import { useCreateList, useUpdateList, boardKeys } from '@/features/board/hooks/useBoard';
import { useLongPressTouchSensor } from '@/features/board/hooks/useLongPressTouchSensor';
import { useBoardLayoutStore } from '@/store/boardLayout.store';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';
import { LabelsManager } from '@/features/project/components/LabelsManager';

// Keeps the library's own mouse + keyboard sensors, but swaps its touch sensor for
// useLongPressTouchSensor — the default's press-and-hold is too short/strict to double
// as a deliberate "lift this card" gesture without fighting scroll (see that file).
const sensors = [useMouseSensor, useKeyboardSensor, useLongPressTouchSensor];

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };
type Filters = { priority: string; status: string };

type TaskStatus = 'DONE' | 'IN_REVIEW' | 'IN_PROGRESS' | 'TODO';

// Infers task status from a column name via substring matching.
// Supports English and Russian column names.
function inferStatus(columnName: string): TaskStatus {
  const n = columnName.toLowerCase();
  if (/done|complet|finish|готов|выполн|завершен|закончен|zrobione|ukończ/.test(n)) return 'DONE';
  if (/review|qa|test|провер|тест/.test(n)) return 'IN_REVIEW';
  if (/progress|doing|active|работ|процесс|выполняет|trakcie|realizacj/.test(n))
    return 'IN_PROGRESS';
  return 'TODO';
}

// How long (ms) to block server-state sync after a drag ends.
// Must be longer than the drop animation (50ms in TaskCard) with room to spare.
const DRAG_COOLDOWN_MS = 500;

interface KanbanBoardProps {
  board: Board & {
    taskLists: Array<{ id: string; name: string; position: number; tasks: Task[] }>;
  };
  boardPath: BoardPath;
  canEdit?: boolean;
  canDelete?: boolean;
  canComment?: boolean;
}

function FilterDropdown({
  filters,
  onChange,
  onClear,
  t,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  onClear: () => void;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasFilters = filters.priority !== '' || filters.status !== '';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        variant={hasFilters ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => setOpen((o) => !o)}
      >
        <Filter className="h-4 w-4 mr-1.5" />
        {t.boards.filter}
        {hasFilters && (
          <span className="ml-1 bg-primary-foreground/20 rounded-full px-1.5 text-xs">!</span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 ml-1 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-card rounded-2xl shadow-lg border border-border p-3 z-50 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t.tasks.priority}</p>
            <select
              value={filters.priority}
              onChange={(e) => onChange({ priority: e.target.value })}
              className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t.boards.allPriorities}</option>
              <option value="URGENT">{t.tasks.priority_URGENT}</option>
              <option value="HIGH">{t.tasks.priority_HIGH}</option>
              <option value="MEDIUM">{t.tasks.priority_MEDIUM}</option>
              <option value="LOW">{t.tasks.priority_LOW}</option>
              <option value="NONE">{t.tasks.priority_NONE}</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t.tasks.status}</p>
            <select
              value={filters.status}
              onChange={(e) => onChange({ status: e.target.value })}
              className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t.boards.allStatuses}</option>
              <option value="TODO">{t.tasks.status_TODO}</option>
              <option value="IN_PROGRESS">{t.tasks.status_IN_PROGRESS}</option>
              <option value="IN_REVIEW">{t.tasks.status_IN_REVIEW}</option>
              <option value="DONE">{t.tasks.status_DONE}</option>
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1"
            >
              <X className="h-3 w-3" /> {t.boards.clearFilters}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Lives in a modal rather than an inline input in the scrolling lane list — a focused
// input inside a scrolling container can get yanked by mobile keyboard-avoidance scroll,
// landing a stray tap on the wrong element. The modal removes the input from that
// container entirely.
function AddColumnModal({
  isOpen,
  onClose,
  boardPath,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  boardPath: BoardPath;
  t: ReturnType<typeof useT>;
}) {
  const [name, setName] = useState('');
  const createList = useCreateList(boardPath);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const submit = () => {
    if (!name.trim()) return;
    createList.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName('');
          onClose();
        },
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.boards.addColumn} size="sm">
      <div className="space-y-4">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={t.boards.columnName}
          className="w-full text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground placeholder-muted-foreground"
        />
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} type="button">
            {t.common.cancel}
          </Button>
          <Button onClick={submit} isLoading={createList.isPending}>
            {t.common.create}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Mobile "move task" picker: a lighter-weight alternative to dragging a card across
// multiple lanes. Reuses the shared Modal (bottom-sheet on mobile).
function MoveTaskModal({
  isOpen,
  onClose,
  task,
  columns,
  onMove,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  columns: Array<{ id: string; name: string }>;
  onMove: (destListId: string) => void;
  t: ReturnType<typeof useT>;
}) {
  if (!task) return null;
  const otherColumns = columns.filter((c) => c.id !== task.taskListId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.boards.moveToColumn} size="sm">
      <p className="text-xs text-muted-foreground mb-3 truncate">{task.title}</p>
      <div className="space-y-1">
        {otherColumns.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t.boards.noOtherColumns}
          </p>
        )}
        {otherColumns.map((col) => (
          <button
            key={col.id}
            type="button"
            onClick={() => onMove(col.id)}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {col.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function KanbanBoard({
  board,
  boardPath,
  canEdit = true,
  canDelete = true,
  canComment = true,
}: KanbanBoardProps) {
  const { workspaceSlug, projectId } = boardPath;
  const t = useT();
  // Global, persisted preference (see boardLayout.store.ts): 'horizontal' = full-width
  // lanes stacked vertically (default), 'vertical' = columns side by side. Every
  // axis-dependent piece below branches on this single value so the modes stay in sync.
  const layoutMode = useBoardLayoutStore((s) => s.mode);
  const toggleLayoutMode = useBoardLayoutStore((s) => s.toggle);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [defaultListId, setDefaultListId] = useState<string | undefined>();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [moveTask, setMoveTask] = useState<Task | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ priority: '', status: '' });
  const updateTask = useUpdateTask(boardPath);
  const updateList = useUpdateList(boardPath);
  const queryClient = useQueryClient();

  // --- Drag state ---
  // timestamp of last drag end; blocks server-state sync for DRAG_COOLDOWN_MS
  const dragEndTime = useRef(0);

  // Source/dest column IDs for the 50ms drop animation window.
  // TaskColumn uses these to show/hide the dnd placeholder correctly.
  const [dropAnim, setDropAnim] = useState<{ sourceId: string; destId: string } | null>(null);

  // --- Column tabs / "where am I" tracking ---
  // `.kanban-lanes-scroll` (ref below) is both the ColumnTabs scroll-jump target and the
  // IntersectionObserver root. columnEls holds each lane's DOM node keyed by list id,
  // registered via a per-id stable callback (getColumnRefCallback) so it doesn't defeat
  // TaskColumn's memoization.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const columnEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const columnRefCallbacks = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const getColumnRefCallback = useCallback((listId: string) => {
    let cb = columnRefCallbacks.current.get(listId);
    if (!cb) {
      cb = (el) => {
        if (el) columnEls.current.set(listId, el);
        else columnEls.current.delete(listId);
      };
      columnRefCallbacks.current.set(listId, cb);
    }
    return cb;
  }, []);

  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  // --- Local lists (single source of truth for the board layout) ---
  const [localLists, setLocalLists] = useState(() =>
    [...board.taskLists].sort((a, b) => a.position - b.position),
  );

  useEffect(() => {
    // During the cooldown after a drag, skip automatic syncs so a polling refetch
    // cannot revert the card to its old position before we manually apply server data.
    if (Date.now() - dragEndTime.current < DRAG_COOLDOWN_MS) return;
    setLocalLists([...board.taskLists].sort((a, b) => a.position - b.position));
  }, [board.taskLists]);

  const filteredLists = useMemo(() => {
    if (!filters.priority && !filters.status) return localLists;
    return localLists.map((list) => ({
      ...list,
      tasks: list.tasks.filter((task) => {
        const matchPriority = !filters.priority || task.priority === filters.priority;
        const matchStatus = !filters.status || task.status === filters.status;
        return matchPriority && matchStatus;
      }),
    }));
  }, [localLists, filters]);

  // Which lane is "most in view" drives ColumnTabs' active highlight — passive
  // orientation ("where am I"), independent of the tap-to-jump action below.
  // Re-observes whenever the set of lanes changes (add/delete/filter).
  const columnIdsKey = filteredLists.map((l) => l.id).join(',');
  useEffect(() => {
    setActiveColumnId((prev) =>
      prev && filteredLists.some((l) => l.id === prev) ? prev : (filteredLists[0]?.id ?? null),
    );

    const root = scrollContainerRef.current;
    if (!root || filteredLists.length < 2) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.columnId;
          if (id) ratios.set(id, entry.intersectionRatio);
        });
        let bestId: string | null = null;
        let bestRatio = 0;
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        if (bestId) setActiveColumnId(bestId);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    filteredLists.forEach((list) => {
      const el = columnEls.current.get(list.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnIdsKey]);

  // Tap-to-jump for ColumnTabs. Axis flips with layoutMode: 'horizontal' jumps vertically
  // to a lane's top edge, 'vertical' jumps horizontally to a column's left edge.
  const scrollToColumn = useCallback(
    (listId: string) => {
      columnEls.current.get(listId)?.scrollIntoView({
        behavior: 'smooth',
        block: layoutMode === 'vertical' ? 'nearest' : 'start',
        inline: layoutMode === 'vertical' ? 'start' : 'nearest',
      });
    },
    [layoutMode],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId, type } = result;

      (document.activeElement as HTMLElement)?.blur();

      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index)
        return;

      // Mark drag end to block useEffect sync during cooldown.
      dragEndTime.current = Date.now();

      if (type === 'COLUMN') {
        // flushSync: React 18 batches updates after onDragEnd returns, but dnd
        // needs the DOM in its final state BEFORE it sets up DROP_ANIMATE.
        flushSync(() => {
          setLocalLists((prev) => {
            const lists = [...prev];
            const [moved] = lists.splice(source.index, 1);
            lists.splice(destination.index, 0, moved);
            return lists.map((l, i) => ({ ...l, position: i }));
          });
        });
        queryClient.setQueryData(
          boardKeys.detail(boardPath.workspaceSlug, boardPath.projectId, boardPath.boardId),
          (old: typeof board | undefined) => {
            if (!old) return old;
            const lists = [...old.taskLists].sort((a, b) => a.position - b.position);
            const [moved] = lists.splice(source.index, 1);
            lists.splice(destination.index, 0, moved);
            return { ...old, taskLists: lists.map((l, i) => ({ ...l, position: i })) };
          },
        );
        updateList.mutate({ listId: draggableId, position: destination.index } as never);
        return;
      }

      // --- Task move ---
      const destListName = localLists.find((l) => l.id === destination.droppableId)?.name ?? '';
      const newStatus = inferStatus(destListName);

      // flushSync: same reasoning as the COLUMN branch above — without it the Draggable
      // unmounts from source and remounts in destination mid-animation, producing a
      // crooked/broken card.
      flushSync(() => {
        setLocalLists((prev) => {
          let movedTask: Task | undefined;
          const without = prev.map((list) => {
            if (list.id !== source.droppableId) return list;
            const tasks = [...list.tasks];
            [movedTask] = tasks.splice(source.index, 1);
            return { ...list, tasks };
          });
          if (!movedTask) return prev;
          const updated: Task = {
            ...movedTask,
            taskListId: destination.droppableId,
            status: newStatus,
          };
          return without.map((list) => {
            if (list.id !== destination.droppableId) return list;
            const tasks = [...list.tasks];
            tasks.splice(destination.index, 0, updated);
            return { ...list, tasks };
          });
        });
        setDropAnim({ sourceId: source.droppableId, destId: destination.droppableId });
      });

      // Clear the drop animation state after the animation completes.
      setTimeout(() => setDropAnim(null), DRAG_COOLDOWN_MS);

      updateTask.mutate({
        taskId: draggableId,
        data: {
          taskListId: destination.droppableId,
          position: destination.index,
          status: newStatus,
        },
      });
    },
    [boardPath, queryClient, updateTask, updateList, localLists],
  );

  // Tap-based alternative to dragging a card across lanes on mobile. Mirrors handleDragEnd's
  // task-move branch (same local-state update + mutation, same inferStatus) so status
  // inference never diverges between drag-and-drop and this picker.
  const handleMoveTask = useCallback(
    (taskId: string, destListId: string) => {
      const sourceList = localLists.find((l) => l.tasks.some((task) => task.id === taskId));
      const destList = localLists.find((l) => l.id === destListId);
      if (!sourceList || !destList || sourceList.id === destList.id) return;

      const newStatus = inferStatus(destList.name);
      const destIndex = destList.tasks.length;

      dragEndTime.current = Date.now();

      setLocalLists((prev) => {
        let movedTask: Task | undefined;
        const without = prev.map((list) => {
          if (list.id !== sourceList.id) return list;
          const tasks = list.tasks.filter((task) => {
            if (task.id === taskId) {
              movedTask = task;
              return false;
            }
            return true;
          });
          return { ...list, tasks };
        });
        if (!movedTask) return prev;
        const updated: Task = { ...movedTask, taskListId: destListId, status: newStatus };
        return without.map((list) =>
          list.id !== destListId ? list : { ...list, tasks: [...list.tasks, updated] },
        );
      });

      updateTask.mutate({
        taskId,
        data: { taskListId: destListId, position: destIndex, status: newStatus },
      });
    },
    [localLists, updateTask],
  );

  // Stable identities so memo(TaskColumn) / memo(TaskCard) can actually bail out
  // on unrelated re-renders (e.g. opening the task detail modal or the create-task modal).
  const handleAddTask = useCallback((listId: string) => {
    setDefaultListId(listId);
    setCreateModalOpen(true);
  }, []);

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleMoveTaskRequest = useCallback((task: Task) => {
    setMoveTask(task);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 min-w-0">
        {/* Board name: hidden on mobile — it's shown in the BoardTabs header above */}
        <div className="hidden sm:block min-w-0 flex-1">
          <h2 className="text-xl font-bold text-foreground truncate">{board.name}</h2>
          {board.description && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{board.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto">
          {canEdit && <LabelsManager workspaceSlug={workspaceSlug} projectId={projectId} />}
          {/* Board-layout toggle: binary preference, so a single icon button flipping it
              directly reads better than a full picker modal. Icon shows the CURRENT mode;
              tooltip names what a click switches TO. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLayoutMode}
            title={
              layoutMode === 'horizontal'
                ? t.boards.layout.switchToVertical
                : t.boards.layout.switchToHorizontal
            }
            aria-label={
              layoutMode === 'horizontal'
                ? t.boards.layout.switchToVertical
                : t.boards.layout.switchToHorizontal
            }
          >
            {layoutMode === 'horizontal' ? (
              <Rows3 className="h-4 w-4" />
            ) : (
              <Columns3 className="h-4 w-4" />
            )}
          </Button>
          <FilterDropdown
            filters={filters}
            onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
            onClear={() => setFilters({ priority: '', status: '' })}
            t={t}
          />
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                // Defaults to the currently-in-view lane (activeColumnId) instead of always
                // localLists[0] — previously this silently created tasks in "To Do" while the
                // user was looking at "In Review". Falls back to the first list if the
                // observer hasn't reported yet.
                setDefaultListId(activeColumnId ?? localLists[0]?.id);
                setCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">{t.boards.addTask}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Lane/column jump nav; active-highlight follows scroll (IntersectionObserver above).
          Breakpoint visibility depends on layout mode — see ColumnTabs' own doc comment. */}
      <ColumnTabs
        columns={filteredLists.map((l) => ({ id: l.id, name: l.name, count: l.tasks.length }))}
        activeId={activeColumnId}
        onSelect={scrollToColumn}
        mobileOnly={layoutMode === 'vertical'}
      />

      <DragDropContext
        onDragEnd={handleDragEnd}
        sensors={sensors}
        enableDefaultSensors={false}
        // Both Droppables are axis-matched to their own scroll container (direction flips
        // with layoutMode; see TaskColumn), so @hello-pangea/dnd's own autoScroller
        // edge-scrolls both natively on mouse and touch — except for TASK drags crossing
        // lanes/columns, which useLongPressTouchSensor handles separately. These options are
        // slightly more generous than the library default (0.3 vs 0.25 start zone, 36 vs 28
        // max px/frame).
        autoScrollerOptions={{
          startFromPercentage: 0.3,
          maxScrollAtPercentage: 0.07,
          maxPixelScroll: 36,
        }}
      >
        <Droppable
          droppableId="board-columns"
          direction={layoutMode === 'vertical' ? 'horizontal' : 'vertical'}
          type="COLUMN"
        >
          {(provided) => (
            <div
              ref={(el) => {
                provided.innerRef(el);
                scrollContainerRef.current = el;
              }}
              className={cn(
                'kanban-lanes-scroll flex-1 min-h-0 select-none scroll-smooth',
                layoutMode === 'vertical'
                  ? // Columns side by side: horizontally scrolling row; items-stretch gives
                    // every column the row's full height. kanban-scroll applies here since
                    // this row is the swipe surface (see globals.css — reserved for one
                    // explicit container).
                    'kanban-scroll flex flex-row items-stretch gap-3 sm:gap-4 overflow-x-auto pr-2 pb-2'
                  : // Lanes stacked vertically: plain vertical scroll (this board's shipped default).
                    'flex flex-col gap-3 sm:gap-4 overflow-y-auto pb-4',
              )}
              {...provided.droppableProps}
            >
              {filteredLists.map((list, index) => (
                <TaskColumn
                  key={list.id}
                  taskList={list}
                  index={index}
                  boardPath={boardPath}
                  onAddTask={handleAddTask}
                  onTaskClick={handleTaskClick}
                  onMoveTask={handleMoveTaskRequest}
                  canEdit={canEdit}
                  dropAnimSource={dropAnim?.sourceId === list.id}
                  dropAnimDest={dropAnim?.destId === list.id}
                  columnRef={getColumnRefCallback(list.id)}
                  layoutMode={layoutMode}
                />
              ))}
              {provided.placeholder}
              {/* "Add lane/column" entry point: full-width strip at the bottom in horizontal
                  mode, a column-width strip stretched to the row's height in vertical mode. */}
              {canEdit && (
                <button
                  onClick={() => setAddColumnOpen(true)}
                  className={cn(
                    'group flex-shrink-0 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 text-muted-foreground transition-colors text-sm font-medium relative overflow-hidden',
                    layoutMode === 'vertical' ? 'w-64 sm:w-72 min-h-[160px]' : 'w-full h-14',
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                    style={{ backgroundImage: 'var(--gradient-signature)' }}
                  />
                  <Plus className="h-4 w-4 relative" />
                  <span className="relative group-hover:bg-clip-text group-hover:text-transparent group-hover:[background-image:var(--gradient-signature)]">
                    {t.boards.addColumn}
                  </span>
                </button>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        taskLists={localLists}
        defaultTaskListId={defaultListId}
        boardPath={boardPath}
      />

      {selectedTask && (
        <TaskDetailModal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          taskId={selectedTask.id}
          initialTask={selectedTask}
          boardPath={boardPath}
          canEdit={canEdit}
          canDelete={canDelete}
          canComment={canComment}
        />
      )}

      <MoveTaskModal
        isOpen={!!moveTask}
        onClose={() => setMoveTask(null)}
        task={moveTask}
        columns={localLists.map((l) => ({ id: l.id, name: l.name }))}
        onMove={(destListId) => {
          if (moveTask) handleMoveTask(moveTask.id, destListId);
          setMoveTask(null);
        }}
        t={t}
      />

      {canEdit && (
        <AddColumnModal
          isOpen={addColumnOpen}
          onClose={() => setAddColumnOpen(false)}
          boardPath={boardPath}
          t={t}
        />
      )}
    </div>
  );
}
