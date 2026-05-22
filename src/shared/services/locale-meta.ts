import type { UiLocale } from './locale.service';

export interface LocaleMeta {
  short: string;
  label: string;
  brand: string;
}

export const LOCALE_META: Record<UiLocale, LocaleMeta> = {
  en: { short: 'EN', label: 'English', brand: 'Opovid' },
  uk: { short: 'УКР', label: 'Українська', brand: 'Оповідь' },
};
