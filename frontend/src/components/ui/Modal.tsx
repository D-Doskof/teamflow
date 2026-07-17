'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Guard against touch "click-through": on mobile, the tap that opened the modal
  // can fire a synthetic click on the freshly-mounted overlay and close it immediately.
  const openedAt = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', onKey);
      openedAt.current = Date.now();
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      // Mobile: align to bottom (bottom-sheet). sm+: center.
      className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center sm:p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === overlayRef.current && Date.now() - openedAt.current > 350) onClose();
      }}
    >
      <div
        className={cn(
          'bg-card text-card-foreground shadow-xl w-full flex flex-col',
          // Mobile: rounded top corners only, full width
          'rounded-t-2xl sm:rounded-app',
          // Desktop: constrained width
          sizeMap[size],
          // Limit max height so it never covers full screen
          'max-h-[92dvh] sm:max-h-[90dvh]',
        )}
      >
        {/* Drag handle visible on mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body — pb adds space for iOS home indicator on mobile */}
        <div
          className="px-4 sm:px-6 py-4 overflow-y-auto flex-1 min-h-0"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
