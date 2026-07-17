/**
 * Theme token derivation.
 *
 * The 6 hand-designed presets (olive/moss/sage/amber/ocean/clay) live as CSS custom
 * properties scoped by `[data-accent="..."]` / `.dark[data-accent="..."]` in globals.css.
 * This module covers everything CSS alone can't:
 *
 *  - `ACCENT_PRESETS`: shared metadata (id, label key, signature flag, gradient) so
 *    UI (ThemePicker) doesn't hardcode the preset list in more than one place.
 *  - `deriveCustomTokens`: a pure function that algorithmically produces the *same*
 *    token shape for an arbitrary hue (0-360), used when accent === 'custom'. Its
 *    output is applied as inline CSS custom properties on <html> (see theme.store.ts),
 *    which naturally overrides the attribute-selector rules in globals.css.
 *
 * The lightness/saturation steps below intentionally mirror the hand-designed presets'
 * recipe (see globals.css) so a custom hue "feels" like a 7th member of the same family
 * rather than a visually distinct system.
 */

export type AccentPreset =
  'olive' | 'moss' | 'sage' | 'amber' | 'ocean' | 'clay' | 'slate' | 'rose' | 'sand' | 'denim';
export type Accent = AccentPreset | 'custom';

export interface AccentPresetMeta {
  id: AccentPreset;
  /** Small 3-stop diagonal gradient, same value used for --gradient-signature. Handy for swatches before the DOM attribute/CSS var is applied. */
  gradient: string;
  signature?: boolean;
}

// Kept in sync with the hand-tuned values in globals.css — see that file for the full
// light+dark token sets. This array only needs what the picker UI renders directly.
/** Small mesh-gradient preview (matches --gradient-signature in globals.css): a few radial
 *  "blobs" of the preset's own colors, blended over a diagonal fallback — the same
 *  multi-point-blend technique behind Telegram's Premium/gift gradients, rather than a
 *  flat single-direction linear-gradient. */
function meshGradient(c1: string, c2: string, c3: string): string {
  return `radial-gradient(at 18% 22%, ${c1}E6 0%, transparent 58%), radial-gradient(at 82% 18%, ${c2}CC 0%, transparent 62%), radial-gradient(at 55% 92%, ${c3}D9 0%, transparent 65%), linear-gradient(135deg, ${c1} 0%, ${c3} 100%)`;
}

export const ACCENT_PRESETS: AccentPresetMeta[] = [
  { id: 'olive', gradient: meshGradient('#5C6B39', '#93A35E', '#D9B45C'), signature: true },
  { id: 'moss', gradient: meshGradient('#1F4A36', '#4F8A68', '#C9A94A') },
  { id: 'sage', gradient: meshGradient('#6B7A68', '#A9B7A5', '#D8CBA8') },
  { id: 'amber', gradient: meshGradient('#8A5F1D', '#D9A63E', '#F0CE84') },
  { id: 'ocean', gradient: meshGradient('#1F4A4D', '#5FA0A6', '#D9B45C') },
  { id: 'clay', gradient: meshGradient('#7A3B22', '#C97D52', '#E8B96B') },
  { id: 'slate', gradient: meshGradient('#22364F', '#577BA8', '#D3B369') },
  { id: 'rose', gradient: meshGradient('#4F2229', '#A85764', '#D3B369') },
  { id: 'sand', gradient: meshGradient('#4F3A22', '#A88257', '#DFBA90') },
  { id: 'denim', gradient: meshGradient('#1F2B47', '#546EAB', '#7DA1D4') },
];

export type Mode = 'light' | 'dark';

/** hsl triplet as "H S% L%" — matches the format used for CSS custom properties in globals.css. */
type HslTriplet = [number, number, number];

function hsl([h, s, l]: HslTriplet): string {
  return `${h} ${s}% ${l}%`;
}

function hslToHex([h, s, l]: HslTriplet): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Full CSS-custom-property set for a given hue, mirroring the shape written by hand
 * for each preset in globals.css. Saturation is deliberately kept in the ~25-45% band
 * (muted, not garish) to match the hand-designed presets' general feel.
 */
export interface DerivedTokens {
  background: string;
  foreground: string;
  card: string;
  'card-foreground': string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  muted: string;
  'muted-foreground': string;
  accent: string;
  'accent-foreground': string;
  border: string;
  ring: string;
  'gradient-signature': string;
}

/** Warm gold contrast stop used as the 3rd gradient stop, matching the hand-designed presets' "aurora" pattern (dark analog -> mid analog -> warm highlight). Hues already inside the warm/gold band use a paler tint of themselves instead, so e.g. a custom amber-ish hue doesn't clash with an unrelated gold. */
const WARM_ACCENT_HUE = 42;

/** Exported so the picker can render a live mesh-gradient swatch for saved custom themes
 *  (same recipe as the hand-designed presets/derived tokens) without re-deriving the full
 *  token set just to get a preview circle. */
export function gradientForHue(h: number): string {
  const isWarmFamily = h >= 20 && h <= 55;
  const stop1 = hslToHex([h, 40, 22]);
  const stop2 = hslToHex([h, 32, 50]);
  const stop3 = isWarmFamily ? hslToHex([h, 55, 72]) : hslToHex([WARM_ACCENT_HUE, 55, 62]);
  return meshGradient(stop1, stop2, stop3);
}

export function deriveCustomTokens(hue: number, mode: Mode): DerivedTokens {
  const h = ((hue % 360) + 360) % 360;
  const isLight = mode === 'light';

  const primary: HslTriplet = isLight ? [h, 35, 40] : [h, 32, 60];
  const primaryFg: HslTriplet = isLight ? [h, 15, 98] : [h, 20, 10];

  const background: HslTriplet = isLight ? [h, 25, 97] : [h, 20, 7];
  const foreground: HslTriplet = isLight ? [h, 18, 14] : [h, 12, 92];
  const card: HslTriplet = isLight ? [h, 15, 99] : [h, 16, 11];
  const secondary: HslTriplet = isLight ? [h, 18, 93] : [h, 15, 17];
  const secondaryFg: HslTriplet = isLight ? [h, 18, 20] : [h, 12, 90];
  const muted: HslTriplet = isLight ? [h, 18, 94] : [h, 15, 15];
  const mutedFg: HslTriplet = isLight ? [h, 8, 42] : [h, 8, 62];
  const border: HslTriplet = isLight ? [h, 18, 88] : [h, 15, 21];

  return {
    background: hsl(background),
    foreground: hsl(foreground),
    card: hsl(card),
    'card-foreground': hsl(foreground),
    primary: hsl(primary),
    'primary-foreground': hsl(primaryFg),
    secondary: hsl(secondary),
    'secondary-foreground': hsl(secondaryFg),
    muted: hsl(muted),
    'muted-foreground': hsl(mutedFg),
    accent: hsl(primary),
    'accent-foreground': hsl(primaryFg),
    border: hsl(border),
    ring: hsl(primary),
    'gradient-signature': gradientForHue(h),
  };
}

/** hex ("#rrggbb") -> hue (0-360). Used by the ThemePicker's hex input to reverse-derive a hue for the custom slider. */
export function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d) % 6;
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return Math.round(h);
}

/** hue -> a representative hex swatch color (mid-tone), for live-previewing the slider thumb/hex input. */
export function hueToPreviewHex(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  return hslToHex([h, 35, 45]);
}
