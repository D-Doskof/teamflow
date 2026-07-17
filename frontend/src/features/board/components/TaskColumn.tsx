'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react';
import { TaskList, Task } from '@/types';
import { TaskCard } from '@/features/task/components/TaskCard';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
import { useUpdateList, useDeleteList } from '@/features/board/hooks/useBoard';
import type { BoardLayoutMode } from '@/store/boardLayout.store';

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };

interface TaskColumnProps {
  taskList: TaskList & { tasks: Task[] };
  boardPath: BoardPath;
  index: number;
  onAddTask: (taskListId: string) => void;
  onTaskClick: (task: Task) => void;
  onMoveTask?: (task: Task) => void;
  canEdit?: boolean;
  dropAnimSource?: boolean;
  dropAnimDest?: boolean;
  // Registers/unregisters this lane's root DOM node with KanbanBoard, which uses it for
  // an IntersectionObserver (ColumnTabs' active-tab highlight) and scrollIntoView. Passed
  // as a stable per-id callback (getColumnRefCallback) so it doesn't defeat memoization.
  columnRef?: (el: HTMLDivElement | null) => void;
  // 'horizontal' = full-width lane, cards scroll sideways within it (default).
  // 'vertical' = fixed-width column, cards stack top-to-bottom within it (see boardLayout.store.ts).
  layoutMode: BoardLayoutMode;
}

export const TaskColumn = memo(function TaskColumn({
  taskList,
  boardPath,
  index,
  onAddTask,
  onTaskClick,
  onMoveTask,
  canEdit = true,
  dropAnimSource = false,
  dropAnimDest = false,
  columnRef,
  layoutMode,
}: TaskColumnProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(taskList.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateList = useUpdateList(boardPath);
  const deleteList = useDeleteList(boardPath);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  const handleRename = () => {
    if (nameValue.trim() && nameValue !== taskList.name) {
      updateList.mutate({ listId: taskList.id, name: nameValue.trim() });
    }
    setRenaming(false);
    setMenuOpen(false);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    setConfirmingDelete(true);
  };

  const confirmDelete = () => {
    deleteList.mutate(taskList.id);
    setConfirmingDelete(false);
  };

  return (
    <Draggable draggableId={taskList.id} index={index} isDragDisabled={!canEdit}>
      {(drag, dragSnapshot) => (
        <div
          ref={(el) => {
            drag.innerRef(el);
            columnRef?.(el);
          }}
          data-column-id={taskList.id}
          {...drag.draggableProps}
          className={cn(
            layoutMode === 'vertical'
              ? // Fixed-width column in the horizontally scrolling `.kanban-lanes-scroll`
                // row — no explicit height: the row's cross-axis stretch gives every column
                // the row's full height, and the task list below scrolls internally.
                'w-64 sm:w-72 flex-shrink-0 flex flex-col transition-shadow select-none'
              : // Full-width lane, stacked vertically with its siblings.
                'w-full flex flex-col transition-shadow select-none',
            dragSnapshot.isDragging && 'shadow-2xl opacity-95',
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {canEdit && (
                <span
                  {...drag.dragHandleProps}
                  style={{ touchAction: 'none' }}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground flex-shrink-0 -ml-1 outline-none focus:outline-none"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
              )}
              {renaming ? (
                <div className="flex items-center gap-1 flex-1 max-w-sm">
                  <input
                    ref={inputRef}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') {
                        setRenaming(false);
                        setNameValue(taskList.name);
                      }
                    }}
                    className="flex-1 text-sm font-semibold border-b border-primary bg-transparent outline-none text-foreground py-0.5"
                  />
                  <button onClick={handleRename} className="text-green-500 flex-shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setRenaming(false);
                      setNameValue(taskList.name);
                    }}
                    className="text-muted-foreground flex-shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-foreground text-[15px] sm:text-base truncate">
                    {taskList.name}
                  </h3>
                  <span className="bg-primary/15 text-primary text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                    {taskList.tasks.length}
                  </span>
                </>
              )}
            </div>

            {!renaming && canEdit && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => onAddTask(taskList.id)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-card rounded-2xl shadow-lg border border-border py-1 z-50">
                      <button
                        onClick={() => {
                          setRenaming(true);
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" /> {t.boards.renameColumn}
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t.boards.deleteColumn}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {confirmingDelete && (
            <div className="flex items-center justify-between px-2.5 py-2 mb-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                {t.boards.deleteColumnConfirm}
              </span>
              <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                <button
                  onClick={confirmDelete}
                  className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                >
                  {t.common.delete}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs px-2 py-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}

          {/* This div is the Droppable's own scrollable frame — the `overflow-*-auto` lives
              right here, which is what lets @hello-pangea/dnd's autoScroller edge-scroll it
              natively. 'horizontal' mode: cards reorder left-right, `overflow-x-auto`,
              `kanban-scroll` (iOS momentum scroll, see globals.css) since this row is the
              swipe surface. 'vertical' mode: cards stack top-to-bottom, `overflow-y-auto`,
              no `kanban-scroll` — that's on the outer `.kanban-lanes-scroll` row instead. */}
          <Droppable
            droppableId={taskList.id}
            type="TASK"
            direction={layoutMode === 'vertical' ? 'vertical' : 'horizontal'}
          >
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  // No shared background behind the cards — the border/tint below is purely
                  // a temporary drop-target cue while dragging over this lane/column, not a
                  // resting-state decoration.
                  'rounded-2xl p-2.5 sm:p-3 transition-colors border-2',
                  layoutMode === 'vertical'
                    ? 'flex-1 min-h-0 flex flex-col items-stretch gap-2.5 overflow-y-auto'
                    : 'kanban-scroll min-h-[108px] sm:min-h-[140px] flex flex-row items-start gap-2.5 sm:gap-3 overflow-x-auto',
                  snapshot.isDraggingOver
                    ? 'bg-primary/10 border-primary/40'
                    : dropAnimSource
                      ? 'border-dashed border-border'
                      : 'border-transparent',
                )}
              >
                {taskList.tasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onClick={onTaskClick}
                    onMove={onMoveTask}
                    canEdit={canEdit}
                    layoutMode={layoutMode}
                  />
                ))}
                {/* isUsingPlaceholder covers drag/drop-animation/cancel; dropAnimDest extends
                    the window 500ms as a safety net after. Collapsed to zero size on whichever
                    axis this Droppable stacks along otherwise. */}
                {snapshot.isUsingPlaceholder || dropAnimDest ? (
                  provided.placeholder
                ) : (
                  <div
                    style={
                      layoutMode === 'vertical'
                        ? { height: 0, overflow: 'hidden' }
                        : { width: 0, overflow: 'hidden' }
                    }
                  >
                    {provided.placeholder}
                  </div>
                )}
                {/* Trailing "add task" block, always shown after the last card, sized like a
                    real card so the list reads as one sequence: card, card, card, [+ add task]. */}
                {canEdit && !snapshot.isDraggingOver && !snapshot.isUsingPlaceholder && (
                  <button
                    type="button"
                    onClick={() => onAddTask(taskList.id)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground',
                      'border-2 border-dashed border-border rounded-2xl transition-colors',
                      'hover:border-primary/40 hover:text-primary hover:bg-primary/5',
                      layoutMode === 'vertical'
                        ? 'w-full min-h-[56px] p-3'
                        : 'w-[42vw] sm:w-64 flex-shrink-0 min-h-[108px] sm:min-h-[140px]',
                    )}
                  >
                    <Plus className="h-4 w-4" /> {t.tasks.add}
                  </button>
                )}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
});
