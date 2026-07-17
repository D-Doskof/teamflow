'use client';

import { useRef, useCallback } from 'react';

interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, onComplete, length = 6, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const update = useCallback(
    (idx: number, char: string) => {
      const next = [...value];
      next[idx] = char;
      onChange(next);
      if (char && idx < length - 1) refs.current[idx + 1]?.focus();
      if (char && idx === length - 1) {
        const code = next.join('');
        if (code.length === length) onComplete?.(code);
      }
    },
    [value, onChange, onComplete, length],
  );

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[idx]) {
        update(idx, '');
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        update(idx - 1, '');
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    const next = pasted.split('').concat(Array(length).fill('')).slice(0, length);
    onChange(next);
    const focusIdx = Math.min(pasted.length, length - 1);
    refs.current[focusIdx]?.focus();
    if (pasted.length >= length) onComplete?.(pasted.slice(0, length));
  };

  return (
    <div className="flex gap-2 sm:gap-3 w-full justify-center" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) {
              const next = v.split('').concat(Array(length).fill('')).slice(0, length);
              onChange(next);
              const focusIdx = Math.min(v.length, length - 1);
              refs.current[focusIdx]?.focus();
              if (v.length >= length) onComplete?.(v.slice(0, length));
              return;
            }
            update(i, v);
          }}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          // font-size must be >= 16px to prevent iOS auto-zoom on focus
          style={{ fontSize: '20px' }}
          className={[
            // square cells — grow equally to fill container width
            'flex-1 min-w-0 max-w-[52px] aspect-square',
            'text-center font-bold rounded-xl transition-all duration-150 outline-none',
            'border-2 bg-card',
            'text-foreground',
            value[i] ? 'border-primary shadow-sm shadow-primary/10' : 'border-border',
            'focus:border-primary focus:shadow-sm focus:shadow-primary/10',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
