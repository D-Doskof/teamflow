'use client';

import { useLocaleStore } from '@/store/locale.store';
import { en } from './en';
import { ru } from './ru';
import { pl } from './pl';

const dictionaries = { en, ru, pl } as const;

export function useT() {
  const { locale, _hydrated } = useLocaleStore();
  return dictionaries[_hydrated ? locale : 'en'];
}
