import { describe, it, expect, beforeEach } from 'vitest';
import { cn, getErrorMessage, getInitials } from './utils';
import { useLocaleStore } from '@/store/locale.store';

function axiosError(data: { message?: string; code?: string }) {
  return { response: { data } };
}

beforeEach(() => {
  useLocaleStore.setState({ locale: 'en' });
});

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts (later wins)', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});

describe('getInitials', () => {
  it('takes the first letter of the first two words, uppercased', () => {
    expect(getInitials('alice smith')).toBe('AS');
  });

  it('handles a single word', () => {
    expect(getInitials('alice')).toBe('A');
  });
});

// Regression coverage for the 2026-07-02 error-i18n feature: backend errors carry an English
// `message` (used as the universal fallback) plus an optional stable `code`; the frontend
// translates the code into the current UI locale when a translation exists.
describe('getErrorMessage', () => {
  it('falls back to the backend message when locale is English, even if a translation exists', () => {
    useLocaleStore.setState({ locale: 'en' });
    const err = axiosError({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

    expect(getErrorMessage(err)).toBe('Invalid credentials');
  });

  it('translates a known code into Russian when the UI locale is ru', () => {
    useLocaleStore.setState({ locale: 'ru' });
    const err = axiosError({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

    expect(getErrorMessage(err)).toBe('Неверный email или пароль');
  });

  it('translates a known code into Polish when the UI locale is pl', () => {
    useLocaleStore.setState({ locale: 'pl' });
    const err = axiosError({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

    expect(getErrorMessage(err)).toBe('Nieprawidłowy email lub hasło');
  });

  it('falls back to the English message when the code has no translation for the current locale', () => {
    useLocaleStore.setState({ locale: 'ru' });
    const err = axiosError({ message: 'Something went wrong', code: 'SOME_UNMAPPED_CODE' });

    expect(getErrorMessage(err)).toBe('Something went wrong');
  });

  it('falls back to a generic message when there is no code at all', () => {
    useLocaleStore.setState({ locale: 'ru' });
    const err = axiosError({ message: 'Workspace not found' });

    expect(getErrorMessage(err)).toBe('Workspace not found');
  });

  it('handles a plain Error instance', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('handles a completely unrecognized value', () => {
    expect(getErrorMessage('nope')).toBe('An unknown error occurred');
  });
});
