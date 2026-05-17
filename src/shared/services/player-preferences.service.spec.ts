import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerPreferencesService } from './player-preferences.service';

const STORAGE_KEY = 'ff14-story-timeline:player-prefs';

function fresh(): PlayerPreferencesService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [PlayerPreferencesService] });
  return TestBed.inject(PlayerPreferencesService);
}

describe('PlayerPreferencesService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with documented defaults', () => {
    const svc = fresh();
    expect(svc.allowTextAnimations()).toBe(true);
    expect(svc.fontSize()).toBe('medium');
    expect(svc.bgmVolume()).toBe(0.7);
    expect(svc.sfxVolume()).toBe(1.0);
  });

  it('persists and restores all four preferences across instances', () => {
    const svc = fresh();
    svc.setAllowTextAnimations(false);
    svc.setFontSize('large');
    svc.setBgmVolume(0.25);
    svc.setSfxVolume(0.5);
    const reborn = fresh();
    expect(reborn.allowTextAnimations()).toBe(false);
    expect(reborn.fontSize()).toBe('large');
    expect(reborn.bgmVolume()).toBe(0.25);
    expect(reborn.sfxVolume()).toBe(0.5);
  });

  it('clamps volumes to [0, 1]', () => {
    const svc = fresh();
    svc.setBgmVolume(-1);
    expect(svc.bgmVolume()).toBe(0);
    svc.setBgmVolume(5);
    expect(svc.bgmVolume()).toBe(1);
    svc.setSfxVolume(Number.NaN);
    expect(svc.sfxVolume()).toBe(0);
  });

  it('rejects unknown font sizes', () => {
    const svc = fresh();
    svc.setFontSize('huge' as unknown as 'small');
    expect(svc.fontSize()).toBe('medium');
  });

  it('falls back to defaults when localStorage holds malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const svc = fresh();
    expect(svc.allowTextAnimations()).toBe(true);
    expect(svc.fontSize()).toBe('medium');
  });

  it('ignores partially valid stored fields rather than crashing', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ allowTextAnimations: 'nope', fontSize: 'xl', bgmVolume: 'loud' }),
    );
    const svc = fresh();
    expect(svc.allowTextAnimations()).toBe(true);
    expect(svc.fontSize()).toBe('xl');
    expect(svc.bgmVolume()).toBe(0.7);
  });

  it('swallows quota errors on persist', () => {
    const svc = fresh();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => svc.setBgmVolume(0.4)).not.toThrow();
    expect(svc.bgmVolume()).toBe(0.4);
    spy.mockRestore();
  });
});
