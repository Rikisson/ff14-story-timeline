import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type FontSize = 'small' | 'medium' | 'large' | 'xl';

const STORAGE_KEY = 'ff14-story-timeline:reader-prefs';
const LEGACY_STORAGE_KEY = 'ff14-story-timeline:player-prefs';
const FONT_SIZES: readonly FontSize[] = ['small', 'medium', 'large', 'xl'];

interface StoredPrefs {
  allowTextAnimations?: unknown;
  fontSize?: unknown;
  bgmVolume?: unknown;
  sfxVolume?: unknown;
  textBoxOpacity?: unknown;
}

const DEFAULTS = {
  allowTextAnimations: true,
  fontSize: 'medium' as FontSize,
  bgmVolume: 0.7,
  sfxVolume: 1.0,
  textBoxOpacity: 0.75,
} as const;

@Injectable({ providedIn: 'root' })
export class ReaderPreferencesService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly allowTextAnimations = signal<boolean>(DEFAULTS.allowTextAnimations);
  readonly fontSize = signal<FontSize>(DEFAULTS.fontSize);
  readonly bgmVolume = signal<number>(DEFAULTS.bgmVolume);
  readonly sfxVolume = signal<number>(DEFAULTS.sfxVolume);
  readonly textBoxOpacity = signal<number>(DEFAULTS.textBoxOpacity);

  constructor() {
    this.hydrateFromStorage();
  }

  setAllowTextAnimations(v: boolean): void {
    this.allowTextAnimations.set(v);
    this.persist();
  }

  setFontSize(v: FontSize): void {
    if (!FONT_SIZES.includes(v)) return;
    this.fontSize.set(v);
    this.persist();
  }

  setBgmVolume(v: number): void {
    this.bgmVolume.set(clamp01(v));
    this.persist();
  }

  setSfxVolume(v: number): void {
    this.sfxVolume.set(clamp01(v));
    this.persist();
  }

  setTextBoxOpacity(v: number): void {
    this.textBoxOpacity.set(clampOpacity(v));
    this.persist();
  }

  private hydrateFromStorage(): void {
    if (!this.isBrowser) return;
    let raw: string | null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        // One-time migration from the legacy 'player-prefs' key.
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy !== null) {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          raw = legacy;
        }
      }
    } catch {
      return;
    }
    if (!raw) return;
    let parsed: StoredPrefs;
    try {
      parsed = JSON.parse(raw) as StoredPrefs;
    } catch {
      return;
    }
    if (typeof parsed.allowTextAnimations === 'boolean') {
      this.allowTextAnimations.set(parsed.allowTextAnimations);
    }
    if (typeof parsed.fontSize === 'string' && FONT_SIZES.includes(parsed.fontSize as FontSize)) {
      this.fontSize.set(parsed.fontSize as FontSize);
    }
    if (typeof parsed.bgmVolume === 'number' && Number.isFinite(parsed.bgmVolume)) {
      this.bgmVolume.set(clamp01(parsed.bgmVolume));
    }
    if (typeof parsed.sfxVolume === 'number' && Number.isFinite(parsed.sfxVolume)) {
      this.sfxVolume.set(clamp01(parsed.sfxVolume));
    }
    if (typeof parsed.textBoxOpacity === 'number' && Number.isFinite(parsed.textBoxOpacity)) {
      this.textBoxOpacity.set(clampOpacity(parsed.textBoxOpacity));
    }
  }

  private persist(): void {
    if (!this.isBrowser) return;
    const payload: StoredPrefs = {
      allowTextAnimations: this.allowTextAnimations(),
      fontSize: this.fontSize(),
      bgmVolume: this.bgmVolume(),
      sfxVolume: this.sfxVolume(),
      textBoxOpacity: this.textBoxOpacity(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage unavailable (private mode, quota); preference stays in memory.
    }
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Text-box translucency floors at 0.7 so the card stays comfortably
// readable — fully hiding it is the separate header toggle's job.
function clampOpacity(v: number): number {
  if (!Number.isFinite(v)) return DEFAULTS.textBoxOpacity;
  if (v < 0.7) return 0.7;
  if (v > 1) return 1;
  return v;
}
