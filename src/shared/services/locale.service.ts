import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LOCALE_META } from './locale-meta';

export type UiLocale = 'en' | 'uk';

const STORAGE_KEY = 'uiLocale';
const SUPPORTED: UiLocale[] = ['en', 'uk'];
const DEFAULT_LOCALE: UiLocale = 'en';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly transloco = inject(TranslocoService);

  readonly active = signal<UiLocale>(this.readInitial());

  readonly supported: readonly UiLocale[] = SUPPORTED;

  constructor() {
    this.transloco.setActiveLang(this.active());

    effect(() => {
      const locale = this.active();
      this.transloco.setActiveLang(locale);
      this.document.documentElement.lang = locale;
    });
  }

  setLocale(locale: UiLocale): void {
    if (!SUPPORTED.includes(locale)) return;
    this.active.set(locale);
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Storage unavailable (private mode, quota); preference stays in memory.
    }
  }

  cycle(): void {
    const current = this.active();
    const idx = SUPPORTED.indexOf(current);
    this.setLocale(SUPPORTED[(idx + 1) % SUPPORTED.length]);
  }

  labelFor(locale: UiLocale): string {
    return LOCALE_META[locale].label;
  }

  shortFor(locale: UiLocale): string {
    return LOCALE_META[locale].short;
  }

  private readInitial(): UiLocale {
    if (!this.isBrowser) return DEFAULT_LOCALE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored as UiLocale)) return stored as UiLocale;
    } catch {
      // ignore
    }
    const langs = navigator.languages ?? [navigator.language];
    for (const lang of langs) {
      const base = lang.toLowerCase().split('-')[0] as UiLocale;
      if (SUPPORTED.includes(base)) return base;
    }
    return DEFAULT_LOCALE;
  }
}
