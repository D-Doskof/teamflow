'use client';

import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface ColumnTabsProps {
  columns: Array<{ id: string; name: string; count: number }>;
  activeId: string | null;
  onSelect: (id: string) => void;
  // True in 'vertical' board-layout mode: columns are already visible side by side at
  // sm+, so this nav row is only useful as a mobile "jump" aid there. False/omitted in
  // 'horizontal' mode, where it's shown at every breakpoint.
  mobileOnly?: boolean;
}

// Compact, tappable row of lane/column "tabs" (name + task count) so a user can jump
// straight to a distant one instead of scrolling past every one in between, and see at a
// glance which one is currently in view. Mirrors BoardTabs' pattern (scrollable row of
// small buttons with an active indicator) but uses a bolder pill/chip treatment so it
// doesn't blend with the page-level board tabs above it.
//
// Breakpoint behavior depends on board layout mode (see mobileOnly above): shown at every
// breakpoint in 'horizontal' mode, since full-width lanes stack vertically on desktop too;
// mobile-only in 'vertical' mode, since columns already sit side by side at sm+.
export function ColumnTabs({ columns, activeId, onSelect, mobileOnly = false }: ColumnTabsProps) {
  const t = useT();

  // Not worth a nav row for a single column.
  if (columns.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label={t.boards.jumpToColumn}
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 -mt-1 [&::-webkit-scrollbar]:hidden',
        mobileOnly && 'sm:hidden',
      )}
      style={{ scrollbarWidth: 'none' }}
    >
      {columns.map((col) => {
        const active = col.id === activeId;
        return (
          <button
            key={col.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${t.boards.jumpToColumn}: ${col.name}`}
            onClick={() => onSelect(col.id)}
            className={cn(
              'flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all',
              active
                ? 'text-primary-foreground shadow-sm'
                : 'bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
            style={active ? { backgroundImage: 'var(--gradient-signature)' } : undefined}
          >
            <span className="truncate max-w-[110px]">{col.name}</span>
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                active ? 'bg-white/25' : 'bg-card text-foreground/70',
              )}
            >
              {col.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
