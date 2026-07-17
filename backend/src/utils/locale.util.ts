// Single source of truth for which locales the backend can render emails in — mirrors the
// frontend's `Locale` type (frontend/src/store/locale.store.ts) without importing across the
// backend/frontend boundary. Keep these two lists in sync by hand if a locale is ever added.
export const SUPPORTED_LOCALES = ['en', 'ru', 'pl'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

// Guards against garbage/forged values getting through — always resolve to one of the
// three locales we actually have templates for.
export function resolveLocale(value: string | null | undefined): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '')
    ? (value as SupportedLocale)
    : DEFAULT_LOCALE;
}
