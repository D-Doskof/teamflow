import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deriveCustomTokens, type Accent } from '@/lib/theme-tokens';

type Theme = 'light' | 'dark';

export interface CustomTheme {
  id: string;
  name: string;
  hue: number;
}

function genId(): string {
  // crypto.randomUUID is available in all browsers this app targets; fall back defensively
  // in case it's ever called in an environment without it (e.g. an older WebView).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ThemeState {
  theme: Theme;
  accent: Accent;
  /** The hue the "Custom" slider currently shows — mirrors the active custom theme (if
   *  any), or an unsaved ephemeral value otherwise. Kept in sync so anything reading
   *  customHue (incl. the pre-hydration script in layout.tsx) never needs saved themes. */
  customHue: number | null;
  /** Saved, named custom themes (Telegram-style "create/save/manage" custom themes). */
  customThemes: CustomTheme[];
  /** Which saved custom theme (if any) is currently live. null = either a preset is active,
   *  or accent === 'custom' with an unsaved/ephemeral hue. */
  activeCustomThemeId: string | null;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  setAccent: (accent: Accent) => void;
  setCustomHue: (hue: number) => void;
  createCustomTheme: (name: string, hue: number) => string;
  renameCustomTheme: (id: string, name: string) => void;
  updateCustomThemeHue: (id: string, hue: number) => void;
  deleteCustomTheme: (id: string) => void;
  applyCustomTheme: (id: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      accent: 'olive',
      customHue: null,
      customThemes: [],
      activeCustomThemeId: null,
      setTheme: (theme) => {
        set({ theme });
        applyThemeAndAccent(theme, get().accent, get().customHue);
      },
      toggle: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
        applyThemeAndAccent(next, get().accent, get().customHue);
      },
      setAccent: (accent) => {
        // Switching to a built-in preset (or away from 'custom') always clears which saved
        // custom theme was active, so re-opening the picker doesn't show a stale selection.
        set({
          accent,
          activeCustomThemeId: accent === 'custom' ? get().activeCustomThemeId : null,
        });
        applyThemeAndAccent(get().theme, accent, get().customHue);
      },
      setCustomHue: (hue) => {
        // Picking a hue implies custom mode — matches the picker's live-preview UX
        // (no separate "select custom" step before dragging the slider). Dragging the
        // slider with no saved theme selected is the "ephemeral" custom slot; if a saved
        // theme IS active, editing its hue live is handled by updateCustomThemeHue instead
        // (the picker UI decides which of the two to call).
        set({ customHue: hue, accent: 'custom', activeCustomThemeId: null });
        applyThemeAndAccent(get().theme, 'custom', hue);
      },
      createCustomTheme: (name, hue) => {
        const id = genId();
        const theme: CustomTheme = { id, name: name.trim() || 'Custom', hue };
        set((s) => ({
          customThemes: [...s.customThemes, theme],
          customHue: hue,
          accent: 'custom',
          activeCustomThemeId: id,
        }));
        applyThemeAndAccent(get().theme, 'custom', hue);
        return id;
      },
      renameCustomTheme: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          customThemes: s.customThemes.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
        }));
      },
      updateCustomThemeHue: (id, hue) => {
        set((s) => ({
          customThemes: s.customThemes.map((t) => (t.id === id ? { ...t, hue } : t)),
          // Only reflect into the live slider/customHue if this theme is the one currently applied.
          ...(s.activeCustomThemeId === id ? { customHue: hue, accent: 'custom' as Accent } : {}),
        }));
        if (get().activeCustomThemeId === id) {
          applyThemeAndAccent(get().theme, 'custom', hue);
        }
      },
      deleteCustomTheme: (id) => {
        const wasActive = get().activeCustomThemeId === id;
        set((s) => ({
          customThemes: s.customThemes.filter((t) => t.id !== id),
          ...(wasActive ? { activeCustomThemeId: null, accent: 'olive' as Accent } : {}),
        }));
        // Deleting the active theme falls back to the signature preset rather than leaving
        // an orphaned "custom" accent with no clear hue behind it.
        if (wasActive) {
          applyThemeAndAccent(get().theme, 'olive', get().customHue);
        }
      },
      applyCustomTheme: (id) => {
        const found = get().customThemes.find((t) => t.id === id);
        if (!found) return;
        set({ accent: 'custom', activeCustomThemeId: id, customHue: found.hue });
        applyThemeAndAccent(get().theme, 'custom', found.hue);
      },
    }),
    {
      name: 'teamflow-theme',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeAndAccent(state.theme, state.accent, state.customHue);
      },
    },
  ),
);

/**
 * Single entry point for applying both theme (light/dark) and accent, called from every
 * action above. Presets: set data-accent, let CSS ([data-accent] + .dark) do the rest.
 * Custom accent: compute tokens for the hue + mode and apply as inline CSS custom
 * properties on <html>, which override the attribute-selector CSS.
 */
function applyThemeAndAccent(theme: Theme, accent: Accent, customHue: number | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');

  if (accent !== 'custom') {
    root.dataset.accent = accent;
    clearCustomProperties(root);
    return;
  }

  const hue = customHue ?? 150;
  const tokens = deriveCustomTokens(hue, theme === 'dark' ? 'dark' : 'light');
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value);
  }
}

const CUSTOM_PROPERTY_KEYS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'border',
  'ring',
  'gradient-signature',
];

// Switching from 'custom' back to a preset must remove the inline overrides, otherwise
// they'd keep winning over the [data-accent] CSS rules (inline styles have higher specificity).
function clearCustomProperties(root: HTMLElement) {
  for (const key of CUSTOM_PROPERTY_KEYS) root.style.removeProperty(`--${key}`);
}
