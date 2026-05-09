import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly systemPrefersDark = signal(this.readSystemPrefersDark());

  readonly preference = signal<ThemePreference>(this.readStoredPreference());

  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this.preference();
    if (pref === 'system') return this.systemPrefersDark() ? 'dark' : 'light';
    return pref;
  });

  constructor() {
    if (this.isBrowser) {
      const mql = window.matchMedia(DARK_MEDIA_QUERY);
      mql.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));
    }

    effect(() => {
      const resolved = this.resolved();
      if (!this.isBrowser) return;
      this.document.documentElement.classList.toggle('dark', resolved === 'dark');
    });
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    if (!this.isBrowser) return;
    try {
      if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Storage unavailable (private mode, quota); preference stays in memory.
    }
  }

  cycle(): void {
    const next: Record<ThemePreference, ThemePreference> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    this.setPreference(next[this.preference()]);
  }

  private readStoredPreference(): ThemePreference {
    if (!this.isBrowser) return 'system';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark') return raw;
    } catch {
      // ignore
    }
    return 'system';
  }

  private readSystemPrefersDark(): boolean {
    if (!this.isBrowser) return false;
    return window.matchMedia(DARK_MEDIA_QUERY).matches;
  }
}
