'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { FluidDragActions, PreDragActions, SensorAPI } from '@hello-pangea/dnd';
import { useBoardLayoutStore, type BoardLayoutMode } from '@/store/boardLayout.store';

type Position = { x: number; y: number };

type Phase =
  | { type: 'IDLE' }
  | {
      type: 'PENDING';
      point: Position;
      actions: PreDragActions;
      isTask: boolean;
      timerId: ReturnType<typeof setTimeout>;
    }
  | { type: 'DRAGGING'; actions: FluidDragActions; hasMoved: boolean; isTask: boolean };

const idle: Phase = { type: 'IDLE' };

// Task cards: a deliberate hold before lifting — long enough that a quick swipe isn't
// mistaken for a drag-lift, short enough that a genuine hold still feels responsive.
// This is what lets a card drag coexist with plain scroll gestures on the same surface
// (see TaskCard's touchAction): a swipe behaves like scroll, only a hold hands off to dnd.
const TASK_LONG_PRESS_MS = 400;

// Lane header grip handle: unchanged from @hello-pangea/dnd's own default
// touch-sensor timing. This sensor only changes activation for task cards —
// lane reordering on touch keeps its original, snappier feel.
const COLUMN_LONG_PRESS_MS = 120;

// Small movement tolerance (task cards only) so natural finger tremor during
// the hold isn't mistaken for the start of a swipe. Columns keep zero
// tolerance, matching the untouched library default exactly.
const TASK_MOVE_TOLERANCE_PX = 8;

const FORCE_PRESS_THRESHOLD = 0.15;

// Marks a Draggable's root DOM node as a "task card" for this sensor's purposes only.
// @hello-pangea/dnd applies one sensor set to the whole DragDropContext (not per
// draggable type), so this is how we distinguish task cards (deliberate long-press)
// from everything else (e.g. the column grip handle, original touch timing).
export const TASK_DRAG_KIND_ATTR = 'data-dnd-kind';
export const TASK_DRAG_KIND_VALUE = 'task-card';

function isTaskCardEvent(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  return !!target?.closest?.(`[${TASK_DRAG_KIND_ATTR}="${TASK_DRAG_KIND_VALUE}"]`);
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// --- Custom cross-lane/cross-column auto-scroll for touch task-card drags ---
//
// @hello-pangea/dnd's own autoScroller (see KanbanBoard's `autoScrollerOptions`) already
// handles both TASK and COLUMN drags natively on their own scroll containers. What it
// can't do in either layout mode: scroll the outer COLUMN-type container
// (`.kanban-lanes-scroll`) while a TASK card is dragged toward its edge to drop into an
// adjacent lane/column — during a TASK-type drag, the library's internal
// `getBestScrollableDroppable` only ever considers TASK-type droppables (or the window),
// never the unrelated COLUMN-type container. Window scroll isn't available either (the
// page shell keeps the board in an `overflow-hidden` region). This sensor owns that one
// remaining case directly, on touch only — scrolling vertically in 'horizontal' mode
// (crossing lanes) or horizontally in 'vertical' mode (crossing columns).
const TOUCH_AUTOSCROLL_ZONE_PCT = 0.28;
const TOUCH_AUTOSCROLL_MAX_PX_PER_FRAME = 16;
const KANBAN_LANES_SCROLL_SELECTOR = '.kanban-lanes-scroll';

// Shared edge-proximity -> scroll-delta math, independent of which axis it's applied to.
// Eases like the library's own default (percentage ** 2): slow near the trigger zone's
// edge, ramping to full speed at the screen edge.
function autoScrollDelta(distFromStart: number, distFromEnd: number, size: number): number {
  const zone = size * TOUCH_AUTOSCROLL_ZONE_PCT;
  let strength = 0;
  let sign = 0;
  if (distFromStart < zone) {
    strength = 1 - Math.max(distFromStart, 0) / zone;
    sign = -1;
  } else if (distFromEnd < zone) {
    strength = 1 - Math.max(distFromEnd, 0) / zone;
    sign = 1;
  }
  if (strength <= 0) return 0;
  return sign * TOUCH_AUTOSCROLL_MAX_PX_PER_FRAME * strength ** 2;
}

function stepAutoScroll(container: HTMLElement, point: Position, mode: BoardLayoutMode) {
  const rect = container.getBoundingClientRect();
  if (mode === 'horizontal') {
    // Lanes stacked vertically — crossing from one lane to the next is a
    // vertical gesture, so this is the axis `.kanban-lanes-scroll` scrolls on.
    const delta = autoScrollDelta(point.y - rect.top, rect.bottom - point.y, rect.height);
    if (delta) container.scrollTop += delta;
  } else {
    // Columns side by side — crossing from one column to the next is a
    // horizontal gesture instead.
    const delta = autoScrollDelta(point.x - rect.left, rect.right - point.x, rect.width);
    if (delta) container.scrollLeft += delta;
  }
}

// Minimal isomorphic layout-effect (avoids pulling in the library's internal
// use-isomorphic-layout-effect module, which isn't part of its public API).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Custom touch sensor for @hello-pangea/dnd, used instead of the library's built-in
 * useTouchSensor for task-card drags (see KanbanBoard's DragDropContext `sensors`/
 * `enableDefaultSensors` props).
 *
 * Why a custom sensor: the library's built-in touch sensor already gates touch drags
 * behind a press-and-hold, cancelling (zero tolerance) on any touchmove before its
 * `timeForLongPress` (120ms) fires — architecturally what we want, but 120ms was tuned
 * for a different problem (avoiding a double-fire with a synthetic click), so it's too
 * short to read as a deliberate "lift this card" gesture, and zero tolerance means finger
 * tremor during a hold can cancel an intended lift. This sensor keeps the same
 * architecture (PENDING -> DRAGGING phase machine, tryGetLock/fluidLift/move) but raises
 * the delay to 400ms and adds a small movement tolerance, for task cards only (see
 * isTaskCardEvent) — the column grip handle keeps the original 120ms/zero-tolerance timing.
 *
 * Pairs with TaskCard's conditional `touchAction` (permissive at rest, `none` while
 * dragging): since `fluidLift` only fires after a genuinely-still hold, the browser never
 * starts a native pan before the lift, so flipping touch-action to 'none' at lift time
 * reliably hands full control to dnd. A quick swipe cancels this sensor before the timer
 * fires, and since touch-action was never flipped, the browser scrolls natively instead.
 *
 * Also drives a custom cross-lane/cross-column auto-scroll of the outer COLUMN-type
 * container while a task drag is active (see stepAutoScroll/startTouchAutoScroll above) —
 * the one case the library's own autoScroller can't cover for TASK drags.
 */
export function useLongPressTouchSensor(api: SensorAPI): void {
  const phaseRef = useRef<Phase>(idle);
  const unbindRef = useRef<() => void>(() => {});

  // Read fresh every render into a ref (not a callback dependency) so toggling layout mode
  // mid-drag can't recreate/rebind the stable callback identities those callbacks rely on.
  const layoutMode = useBoardLayoutStore((s) => s.mode);
  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;

  const setPhase = useCallback((phase: Phase) => {
    phaseRef.current = phase;
  }, []);

  // Mutual refs let these callbacks reference each other without a
  // declaration-order dependency cycle (mirrors the pattern used by the
  // library's own sensor implementations).
  const listenForCaptureRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});
  const cancelRef = useRef<() => void>(() => {});
  const startDraggingRef = useRef<() => void>(() => {});

  // Last known touch position + rAF handle for the custom cross-lane/column
  // auto-scroll loop (task drags only — see stepAutoScroll above).
  const lastPointRef = useRef<Position | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const prevScrollBehaviorRef = useRef<string>('');

  const stopTouchAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current != null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    // Restore whatever scroll-behavior the lane list had before (its
    // `scroll-smooth` Tailwind class, used for ColumnTabs' tap-to-jump) — see
    // startTouchAutoScroll for why we override it.
    if (scrollElRef.current) {
      scrollElRef.current.style.scrollBehavior = prevScrollBehaviorRef.current;
    }
    scrollElRef.current = null;
    lastPointRef.current = null;
  }, []);

  const startTouchAutoScroll = useCallback(() => {
    const container = document.querySelector<HTMLElement>(KANBAN_LANES_SCROLL_SELECTOR);
    if (!container) return;
    scrollElRef.current = container;
    // The lane list has `scroll-smooth` for ColumnTabs' tap-to-jump. Repeatedly assigning
    // `scrollTop` every frame while that's active fights its own queued smooth-scroll
    // animation and produces janky motion — switch to instant scrolling only while this
    // loop owns scrollTop, then restore it on drop/cancel.
    prevScrollBehaviorRef.current = container.style.scrollBehavior;
    container.style.scrollBehavior = 'auto';

    const tick = () => {
      const point = lastPointRef.current;
      if (point && scrollElRef.current)
        stepAutoScroll(scrollElRef.current, point, layoutModeRef.current);
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };
    autoScrollRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    const current = phaseRef.current;
    if (current.type === 'IDLE') return;
    if (current.type === 'PENDING') clearTimeout(current.timerId);
    stopTouchAutoScroll();
    setPhase(idle);
    unbindRef.current();
    listenForCaptureRef.current();
  }, [setPhase, stopTouchAutoScroll]);
  stopRef.current = stop;

  const cancel = useCallback(() => {
    const phase = phaseRef.current;
    stopRef.current();
    if (phase.type === 'DRAGGING') phase.actions.cancel({ shouldBlockNextClick: true });
    if (phase.type === 'PENDING') phase.actions.abort();
  }, []);
  cancelRef.current = cancel;

  const bindCapturingEvents = useCallback(() => {
    const options: AddEventListenerOptions = { capture: true, passive: false };

    const onTouchMove = (event: TouchEvent) => {
      const phase = phaseRef.current;
      if (phase.type !== 'DRAGGING') {
        if (phase.type === 'PENDING') {
          const touch = event.touches[0];
          const tolerance = phase.isTask ? TASK_MOVE_TOLERANCE_PX : 0;
          const moved = distance(phase.point, { x: touch.clientX, y: touch.clientY });
          // Within tolerance: keep waiting for the long-press timer, and don't
          // preventDefault — if the timer never fires (user lets go / keeps
          // swiping past tolerance next event) the browser stays free to scroll.
          if (moved <= tolerance) return;
        }
        cancelRef.current();
        return;
      }

      phase.hasMoved = true;
      const touch = event.touches[0];
      const point: Position = { x: touch.clientX, y: touch.clientY };
      event.preventDefault();
      phase.actions.move(point);
      if (phase.isTask) lastPointRef.current = point;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const phase = phaseRef.current;
      if (phase.type !== 'DRAGGING') {
        cancelRef.current();
        return;
      }
      event.preventDefault();
      phase.actions.drop({ shouldBlockNextClick: true });
      stopRef.current();
    };

    const onTouchCancel = (event: TouchEvent) => {
      if (phaseRef.current.type !== 'DRAGGING') {
        cancelRef.current();
        return;
      }
      event.preventDefault();
      cancelRef.current();
    };

    const onOrientationOrResize = () => cancelRef.current();
    const onContextMenu = (event: Event) => event.preventDefault();

    const onKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current.type !== 'DRAGGING') {
        cancelRef.current();
        return;
      }
      if (event.key === 'Escape') event.preventDefault();
      cancelRef.current();
    };

    const onVisibilityChange = () => cancelRef.current();

    const onForceChange = (event: Event) => {
      const phase = phaseRef.current;
      if (phase.type === 'IDLE') return;
      const touch = (event as TouchEvent).touches[0] as (Touch & { force?: number }) | undefined;
      if (!touch || typeof touch.force !== 'number') return;
      if (touch.force < FORCE_PRESS_THRESHOLD) return;
      const shouldRespect = phase.actions.shouldRespectForcePress();

      if (phase.type === 'PENDING') {
        if (shouldRespect) cancelRef.current();
        return;
      }
      if (phase.type === 'DRAGGING') {
        if (shouldRespect) {
          if (phase.hasMoved) {
            event.preventDefault();
            return;
          }
          cancelRef.current();
          return;
        }
        event.preventDefault();
      }
    };

    window.addEventListener('touchmove', onTouchMove, options);
    window.addEventListener('touchend', onTouchEnd, options);
    window.addEventListener('touchcancel', onTouchCancel, options);
    window.addEventListener('touchforcechange', onForceChange, options);
    window.addEventListener('orientationchange', onOrientationOrResize, options);
    window.addEventListener('resize', onOrientationOrResize, options);
    window.addEventListener('contextmenu', onContextMenu, options);
    window.addEventListener('keydown', onKeyDown, options);
    window.addEventListener('visibilitychange', onVisibilityChange, options);

    unbindRef.current = () => {
      window.removeEventListener('touchmove', onTouchMove, options);
      window.removeEventListener('touchend', onTouchEnd, options);
      window.removeEventListener('touchcancel', onTouchCancel, options);
      window.removeEventListener('touchforcechange', onForceChange, options);
      window.removeEventListener('orientationchange', onOrientationOrResize, options);
      window.removeEventListener('resize', onOrientationOrResize, options);
      window.removeEventListener('contextmenu', onContextMenu, options);
      window.removeEventListener('keydown', onKeyDown, options);
      window.removeEventListener('visibilitychange', onVisibilityChange, options);
    };
  }, []);

  const startDragging = useCallback(() => {
    const phase = phaseRef.current;
    if (phase.type !== 'PENDING') return;
    const actions = phase.actions.fluidLift(phase.point);
    setPhase({ type: 'DRAGGING', actions, hasMoved: false, isTask: phase.isTask });
    if (phase.isTask) {
      lastPointRef.current = phase.point;
      startTouchAutoScroll();
    }
  }, [setPhase, startTouchAutoScroll]);
  startDraggingRef.current = startDragging;

  const startPendingDrag = useCallback(
    (actions: PreDragActions, point: Position, isTask: boolean) => {
      const delay = isTask ? TASK_LONG_PRESS_MS : COLUMN_LONG_PRESS_MS;
      const timerId = setTimeout(() => startDraggingRef.current(), delay);
      setPhase({ type: 'PENDING', point, actions, isTask, timerId });
      bindCapturingEvents();
    },
    [setPhase, bindCapturingEvents],
  );

  const listenForCapture = useCallback(() => {
    const options: AddEventListenerOptions = { capture: true, passive: false };

    const onTouchStart = (event: TouchEvent) => {
      if (event.defaultPrevented) return;

      const draggableId = api.findClosestDraggableId(event);
      if (!draggableId) return;

      const actions = api.tryGetLock(draggableId, () => stopRef.current(), { sourceEvent: event });
      if (!actions) return;

      const touch = event.touches[0];
      const point: Position = { x: touch.clientX, y: touch.clientY };
      const isTask = isTaskCardEvent(event);

      unbindRef.current();
      startPendingDrag(actions, point, isTask);
    };

    window.addEventListener('touchstart', onTouchStart, options);
    unbindRef.current = () => window.removeEventListener('touchstart', onTouchStart, options);
  }, [api, startPendingDrag]);
  listenForCaptureRef.current = listenForCapture;

  useIsomorphicLayoutEffect(() => {
    listenForCaptureRef.current();
    return () => {
      unbindRef.current();
      const phase = phaseRef.current;
      if (phase.type === 'PENDING') {
        clearTimeout(phase.timerId);
        setPhase(idle);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
