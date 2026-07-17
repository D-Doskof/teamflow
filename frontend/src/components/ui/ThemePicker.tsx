'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, MoreHorizontal, Palette, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
import { useThemeStore } from '@/store/theme.store';
import { ACCENT_PRESETS, gradientForHue, hexToHue, hueToPreviewHex } from '@/lib/theme-tokens';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * The actual picker UI — presets grid + saved custom themes + custom hue slider. Rendered
 * both inside the quick-access Modal (see ThemePicker below) and inline as a Settings page
 * section, so it's kept independent of any dialog chrome.
 */
export function ThemePickerContent() {
  const t = useT();
  const {
    accent,
    customHue,
    customThemes,
    activeCustomThemeId,
    setAccent,
    setCustomHue,
    createCustomTheme,
    renameCustomTheme,
    updateCustomThemeHue,
    deleteCustomTheme,
    applyCustomTheme,
  } = useThemeStore();

  const [hexDraft, setHexDraft] = useState('');
  const [hexError, setHexError] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpenId]);

  const previewHue = customHue ?? 150;
  const previewHex = hueToPreviewHex(previewHue);
  const activeTheme = customThemes.find((th) => th.id === activeCustomThemeId) ?? null;
  const isEphemeralCustom = accent === 'custom' && !activeCustomThemeId;

  // Dragging the slider either live-edits the active saved theme in place, or updates the
  // ephemeral custom slot if no saved theme is currently selected — see theme.store.ts.
  const handleHueChange = (hue: number) => {
    if (activeCustomThemeId) updateCustomThemeHue(activeCustomThemeId, hue);
    else setCustomHue(hue);
  };

  const handleHexChange = (value: string) => {
    setHexDraft(value);
    if (!value) {
      setHexError(false);
      return;
    }
    const hue = hexToHue(value);
    if (hue === null) {
      setHexError(true);
      return;
    }
    setHexError(false);
    handleHueChange(hue);
  };

  const handleSaveNew = () => {
    const name = nameDraft.trim();
    if (!name) return;
    createCustomTheme(name, previewHue);
    setNameDraft('');
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameDraft(currentName);
    setMenuOpenId(null);
  };

  const commitRename = (id: string) => {
    renameCustomTheme(id, renameDraft);
    setRenamingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="grid grid-cols-3 gap-3">
          {ACCENT_PRESETS.map((preset) => {
            const isActive = accent === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAccent(preset.id)}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-colors',
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-foreground/30',
                )}
              >
                {preset.signature && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap">
                    {t.theme.signature}
                  </span>
                )}
                <span
                  className="h-10 w-10 rounded-full shadow-sm flex items-center justify-center flex-shrink-0"
                  style={{ background: preset.gradient }}
                >
                  {isActive && <Check className="h-4 w-4 text-white drop-shadow" />}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {t.theme.presets[preset.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {customThemes.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2.5 mt-4">
            {t.theme.saved.title}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {customThemes.map((th) => {
              const isActive = accent === 'custom' && activeCustomThemeId === th.id;
              const isRenaming = renamingId === th.id;
              const isConfirmingDelete = confirmDeleteId === th.id;
              const isMenuOpen = menuOpenId === th.id;
              return (
                <div
                  key={th.id}
                  ref={isMenuOpen ? menuRef : undefined}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-2xl border transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  {!isRenaming && !isConfirmingDelete && (
                    <button
                      type="button"
                      onClick={() => setMenuOpenId((cur) => (cur === th.id ? null : th.id))}
                      className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                  )}

                  {isMenuOpen && (
                    <div className="absolute right-0 top-7 w-32 bg-card rounded-xl shadow-lg border border-border py-1 z-10">
                      <button
                        type="button"
                        onClick={() => startRename(th.id, th.name)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary"
                      >
                        <Pencil className="h-3 w-3" /> {t.theme.saved.rename}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(th.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3 w-3" /> {t.theme.saved.delete}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => applyCustomTheme(th.id)}
                    disabled={isRenaming || isConfirmingDelete}
                    className="h-10 w-10 rounded-full shadow-sm flex items-center justify-center flex-shrink-0"
                    style={{ background: gradientForHue(th.hue) }}
                  >
                    {isActive && <Check className="h-4 w-4 text-white drop-shadow" />}
                  </button>

                  {isConfirmingDelete ? (
                    <div className="flex flex-col items-center gap-1 w-full">
                      <span className="text-[10px] text-red-600 dark:text-red-400 font-medium text-center leading-tight">
                        {t.theme.saved.deleteConfirm}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            deleteCustomTheme(th.id);
                            setConfirmDeleteId(null);
                          }}
                          className="text-[10px] px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                        >
                          {t.common.delete}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10px] px-1.5 py-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {t.common.cancel}
                        </button>
                      </div>
                    </div>
                  ) : isRenaming ? (
                    <div className="flex items-center gap-1 w-full">
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(th.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="w-full min-w-0 text-xs border-b border-primary bg-transparent outline-none text-foreground text-center py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(th.id)}
                        className="text-green-500 flex-shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="text-muted-foreground flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-foreground truncate max-w-full">
                      {th.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => setCustomHue(previewHue)}
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors mt-4',
            isEphemeralCustom
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-foreground/30',
          )}
        >
          <span
            className="h-10 w-10 rounded-full shadow-sm flex-shrink-0 flex items-center justify-center"
            style={{ backgroundColor: previewHex }}
          >
            {isEphemeralCustom && <Check className="h-4 w-4 text-white drop-shadow" />}
          </span>
          <span className="flex-1 text-left">
            <span className="block text-sm font-medium text-foreground">{t.theme.custom}</span>
            <span className="block text-xs text-muted-foreground">{t.theme.customHint}</span>
          </span>
        </button>

        <div className="mt-4 space-y-3">
          {activeTheme && (
            <p className="text-xs text-muted-foreground -mt-1">
              {t.theme.saved.editingHint(activeTheme.name)}
            </p>
          )}

          <div>
            <label className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{t.theme.hue}</span>
              <span className="font-mono">{previewHue}°</span>
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={previewHue}
              onChange={(e) => {
                setHexError(false);
                setHexDraft('');
                handleHueChange(Number(e.target.value));
              }}
              className="w-full h-3 rounded-full appearance-none cursor-pointer accent-current"
              style={{
                background:
                  'linear-gradient(to right, hsl(0 55% 50%), hsl(60 55% 50%), hsl(120 55% 50%), hsl(180 55% 50%), hsl(240 55% 50%), hsl(300 55% 50%), hsl(360 55% 50%))',
                color: previewHex,
              }}
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">{t.theme.hex}</label>
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder={t.theme.hexPlaceholder}
              className={cn(
                'w-full px-3 py-2 text-sm rounded-lg border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                hexError ? 'border-red-400' : 'border-border',
              )}
            />
            {hexError && <p className="text-xs text-red-500 mt-1">{t.theme.hexInvalid}</p>}
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              {t.theme.saved.namePlaceholder}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNew();
                }}
                placeholder={t.theme.saved.namePlaceholder}
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="button" size="md" onClick={handleSaveNew} disabled={!nameDraft.trim()}>
                {t.theme.saved.save}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Quick-access entry point: icon button that opens the picker in a (bottom-sheet-on-mobile) Modal. */
export function ThemePicker() {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        title={t.theme.quickAccess}
      >
        <Palette className="h-5 w-5" />
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={t.theme.title} size="md">
        <p className="text-sm text-muted-foreground -mt-2 mb-4">{t.theme.subtitle}</p>
        <ThemePickerContent />
      </Modal>
    </>
  );
}
