'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useLocaleStore, type Locale } from '@/store/locale.store';

const LANGS: { value: Locale; label: string; flag: string; name: string }[] = [
  { value: 'en', label: 'EN', flag: '🇬🇧', name: 'English' },
  { value: 'ru', label: 'RU', flag: '🇷🇺', name: 'Русский' },
  { value: 'pl', label: 'PL', flag: '🇵🇱', name: 'Polski' },
];

const MENU_WIDTH = 144; // matches w-36
const VIEWPORT_MARGIN = 8;
// Each row is py-2 text-sm (~40px) plus the menu's own py-1 container padding (~8px) —
// fixed since LANGS never changes length at runtime, so this is cheap to compute up
// front instead of measuring the menu after it renders (which would need an extra
// render pass just to reposition it, visible as a one-frame jump).
const MENU_HEIGHT = LANGS.length * 40 + 8;

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleStore();
  const [open, setOpen] = useState(false);
  // Positioned via measured coordinates rather than a CSS-only `absolute right-0`, since
  // this component renders in several very different containers (navbar, landing header,
  // cramped mobile sidebar) where a fixed `right-0` menu can clip off the viewport edge.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = LANGS.find((l) => l.value === locale) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    const reposition = () => setOpen(false); // simplest correct behavior on resize/rotate
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const toggleOpen = () => {
    if (!open) {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) {
        let left = rect.right - MENU_WIDTH;
        left = Math.max(
          VIEWPORT_MARGIN,
          Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
        );
        // Flip above the button when there isn't room below (e.g. the mobile sidebar
        // footer) — same off-screen-clipping problem as the horizontal clamp, other axis.
        const fitsBelow = rect.bottom + 4 + MENU_HEIGHT <= window.innerHeight - VIEWPORT_MARGIN;
        const top = fitsBelow ? rect.bottom + 4 : rect.top - MENU_HEIGHT - 4;
        setCoords({ top: Math.max(VIEWPORT_MARGIN, top), left });
      }
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && coords && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
          className="bg-card rounded-xl shadow-lg border border-border py-1 z-50"
        >
          {LANGS.map((lang) => (
            <button
              key={lang.value}
              onClick={() => {
                setLocale(lang.value);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <span>{lang.flag}</span>
              <span className="flex-1 text-left">{lang.name}</span>
              {locale === lang.value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
