'use client';

import { memo, useRef } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, MessageSquare, Paperclip, User, ArrowLeftRight } from 'lucide-react';
import { Task } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
import {
  TASK_DRAG_KIND_ATTR,
  TASK_DRAG_KIND_VALUE,
} from '@/features/board/hooks/useLongPressTouchSensor';
import type { BoardLayoutMode } from '@/store/boardLayout.store';

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: (task: Task) => void;
  // Opens the "move to column" picker (KanbanBoard owns the modal + mutation).
  // Optional + mobile-only in the UI so desktop drag-and-drop stays uncluttered.
  onMove?: (task: Task) => void;
  canEdit?: boolean;
  // Drilled down from KanbanBoard (via TaskColumn) rather than read from
  // useBoardLayoutStore directly — keeps re-render triggers limited to props like the
  // rest of the board tree, and toggling layout mode already re-renders every TaskColumn
  // anyway, so the cascade down to TaskCard is free either way.
  layoutMode: BoardLayoutMode;
}

const PRIORITY_BORDER: Record<string, string> = {
  NONE: 'transparent',
  LOW: '#60a5fa',
  MEDIUM: '#facc15',
  HIGH: '#fb923c',
  URGENT: '#ef4444',
};

export const TaskCard = memo(function TaskCard({
  task,
  index,
  onClick,
  onMove,
  canEdit = true,
  layoutMode,
}: TaskCardProps) {
  const t = useT();
  const isDueSoon =
    task.dueDate && new Date(task.dueDate) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  // On touch, touchAction:none can suppress the synthetic click event on iOS.
  // Use pointerUp to detect taps; set firedByTouch to skip the subsequent synthetic click.
  const pointerMoved = useRef(false);
  const firedByTouch = useRef(false);

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={!canEdit}>
      {(provided, snapshot) => {
        // Append our own "picked up" scale onto whatever transform dnd already applies
        // inline (its own translate while dragging). Can't use a Tailwind transform class
        // instead — dnd's inline `transform` style always wins, silently overriding it.
        const liftTransform = snapshot.isDragging ? 'scale(1.045)' : '';
        const baseTransform = provided.draggableProps.style?.transform;
        const composedTransform =
          [baseTransform, liftTransform].filter(Boolean).join(' ') || undefined;

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            // Marks this as a "task card" for useLongPressTouchSensor, so it gets the
            // deliberate long-press-to-lift timing instead of the library's default
            // (unchanged) touch timing used elsewhere (e.g. the column grip handle).
            {...{ [TASK_DRAG_KIND_ATTR]: TASK_DRAG_KIND_VALUE }}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') {
                pointerMoved.current = false;
                firedByTouch.current = false;
              }
            }}
            onPointerMove={(e) => {
              if (e.pointerType === 'touch') pointerMoved.current = true;
            }}
            onPointerUp={(e) => {
              if (e.pointerType === 'touch' && !pointerMoved.current && !snapshot.isDragging) {
                firedByTouch.current = true;
                onClick(task);
              }
            }}
            onClick={() => {
              // Skip if already handled by touch onPointerUp (avoids double-fire)
              if (firedByTouch.current) {
                firedByTouch.current = false;
                return;
              }
              if (!snapshot.isDragging) onClick(task);
            }}
            style={{
              ...provided.draggableProps.style,
              transform: composedTransform,
              // Permissive by default, locked to 'none' only once actually dragging (see
              // useLongPressTouchSensor — this ordering is what lets a deliberate hold take
              // over from a plain swipe). Which axes stay permissive depends on layout mode:
              // 'horizontal' (cards laid out horizontally within a lane) treats both axes as
              // someone else's scroll; 'vertical' (cards stacked within a column) only frees
              // pan-x, since a vertical swipe there is the card's own reorder gesture.
              // Only matters on touch — desktop mouse drag isn't touch-driven.
              touchAction: snapshot.isDragging
                ? 'none'
                : layoutMode === 'vertical'
                  ? 'pan-x'
                  : 'pan-x pan-y',
              userSelect: 'none',
            }}
            className={cn(
              layoutMode === 'vertical'
                ? // Vertical mode: cards stack top-to-bottom filling the column's width.
                  'w-full'
                : // Horizontal mode: cards sit side-by-side in a scrolling lane row, so each
                  // needs a fixed size. 42vw on mobile shows one full card plus a peek of the
                  // next (the cue that the row scrolls); sm+ gets a fixed, comfortable size.
                  'w-[42vw] sm:w-64 flex-shrink-0',
              'relative overflow-hidden bg-card rounded-2xl border border-border/70',
              // Narrow mobile cards (see width above) can't afford the full padding without
              // feeling cramped — tightened below sm, original padding at sm+ / vertical mode.
              layoutMode === 'vertical' ? 'p-3.5 pt-4' : 'p-2.5 pt-3.5 sm:p-3.5 sm:pt-4',
              'cursor-grab active:cursor-grabbing hover:shadow-md group',
              'outline-none focus:outline-none select-none transition-shadow duration-150',
              snapshot.isDragging
                ? 'shadow-2xl ring-2 ring-primary/50'
                : snapshot.isDropAnimating
                  ? 'shadow-2xl ring-2 ring-primary/50'
                  : 'shadow-sm',
            )}
          >
            {/* Priority indicator: full-width top stripe, omitted for NONE. */}
            {task.priority !== 'NONE' && (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ backgroundColor: PRIORITY_BORDER[task.priority] }}
              />
            )}

            <div
              className={cn(
                'flex items-start justify-between gap-1.5',
                layoutMode === 'vertical' ? 'mb-2.5' : 'mb-2 sm:mb-2.5',
              )}
            >
              {/* Slightly smaller on mobile to match the narrower 42vw card width. */}
              <p
                className={cn(
                  'leading-snug font-semibold text-foreground line-clamp-2 flex-1 min-w-0 group-hover:text-primary',
                  layoutMode === 'vertical' ? 'text-[15px]' : 'text-sm sm:text-[15px]',
                )}
              >
                {task.title}
              </p>
            </div>

            {task.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2.5">
                {task.labels.map(({ label }) => (
                  <span
                    key={label.id}
                    className="px-1.5 py-0.5 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <div
                className={cn(
                  'flex items-center text-xs text-muted-foreground',
                  layoutMode === 'vertical' ? 'gap-2' : 'gap-1.5 sm:gap-2',
                )}
              >
                {task.dueDate && (
                  <span
                    className={cn(
                      'flex items-center gap-1',
                      isDueSoon ? 'text-red-500 font-medium' : 'text-muted-foreground',
                    )}
                  >
                    <Calendar className="h-3 w-3" />
                    {formatDate(task.dueDate)}
                  </span>
                )}
                {!!task._count?.comments && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {task._count.comments}
                  </span>
                )}
                {!!task._count?.attachments && (
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {task._count.attachments}
                  </span>
                )}
              </div>

              {task.assignees.length > 0 ? (
                <div className="flex -space-x-1.5">
                  {task.assignees.slice(0, 3).map(({ user }) => (
                    <Avatar
                      key={user.id}
                      name={user.name}
                      src={user.avatar}
                      size="sm"
                      // Sized down below sm in horizontal mode only — the 42vw mobile card
                      // doesn't have room for 3 full 32px avatars without crowding.
                      className={cn(
                        'ring-2 ring-primary/30 ring-offset-1 ring-offset-card',
                        layoutMode === 'horizontal' &&
                          'h-6 w-6 text-[10px] sm:h-8 sm:w-8 sm:text-xs',
                      )}
                    />
                  ))}
                  {task.assignees.length > 3 && (
                    <div
                      className={cn(
                        'rounded-full bg-secondary ring-2 ring-card flex items-center justify-center font-medium text-secondary-foreground',
                        layoutMode === 'horizontal'
                          ? 'h-6 w-6 text-[10px] sm:h-8 sm:w-8 sm:text-xs'
                          : 'h-8 w-8 text-xs',
                      )}
                    >
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <User className="h-4 w-4 text-muted-foreground/60" />
              )}
            </div>

            {canEdit && onMove && (
              // Mobile-only fallback for moving a card between columns without the
              // long-press-to-lift drag gesture (see useLongPressTouchSensor).
              <button
                type="button"
                // Stop the pointer lifecycle at every stage, not just pointerdown: the card's
                // own onPointerUp (iOS Safari touch-tap workaround above) doesn't know a
                // pointerup came from this nested button, so it still fires onClick(task) and
                // races the modal open with onMove(task) — the card's onClick early-return is
                // too late, since pointerup fires first.
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(task);
                }}
                className="sm:hidden w-full flex items-center justify-center gap-1.5 mt-2.5 pt-2 -mb-1 border-t border-border text-xs font-medium text-muted-foreground hover:text-primary active:bg-secondary rounded-b-lg transition-colors min-h-[36px]"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                {t.boards.move}
              </button>
            )}
          </div>
        );
      }}
    </Draggable>
  );
});
