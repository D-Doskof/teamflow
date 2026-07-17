'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Global, persisted preference for how Kanban boards are laid out — mirrors
 * theme.store.ts's shape (skipHydration + manual rehydrate, see BoardLayoutInit in
 * providers.tsx) but deliberately skips theme.store.ts's pre-hydration <script> in
 * app/layout.tsx: that script avoids a flash of the wrong color on every page before
 * React hydrates, but KanbanBoard is a client component several navigations deep, so by
 * the time it renders, this store has already had a chance to rehydrate. Worst case is a
 * brief render with the default before rehydration flips it — an acceptable
 * simplification, unlike theme/accent which paint the entire app shell first.
 *
 * 'horizontal' = full-width status lanes stacked vertically (default). 'vertical' = the
 * original columns-side-by-side layout.
 */
export type BoardLayoutMode = 'horizontal' | 'vertical';

interface BoardLayoutState {
  mode: BoardLayoutMode;
  setMode: (mode: BoardLayoutMode) => void;
  toggle: () => void;
}

export const useBoardLayoutStore = create<BoardLayoutState>()(
  persist(
    (set, get) => ({
      mode: 'horizontal',
      setMode: (mode) => set({ mode }),
      toggle: () => set({ mode: get().mode === 'horizontal' ? 'vertical' : 'horizontal' }),
    }),
    {
      name: 'teamflow-board-layout',
      skipHydration: true,
    },
  ),
);
