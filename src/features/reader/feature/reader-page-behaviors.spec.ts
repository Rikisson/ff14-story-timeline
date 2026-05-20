import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChromeIdle, createReaderFade } from './reader-page-behaviors';

describe('createReaderFade', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('starts hidden and input-blocking before the fade-in runs', () => {
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(false), signal('story-a')),
    );

    expect(fade.opacity()).toBe(0);
    expect(fade.ready()).toBe(false);
    expect(fade.blocksInput()).toBe(true);
  });

  it('skips the fade-in under reduced motion: content starts visible and ready', () => {
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(true), signal('story-a')),
    );

    expect(fade.opacity()).toBe(1);
    expect(fade.ready()).toBe(true);
    expect(fade.blocksInput()).toBe(false);
  });

  it('fadeOut() fades the content out, and is idempotent', async () => {
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(true), signal('story-a')),
    );

    const first = fade.fadeOut();
    expect(fade.fadeOut()).toBe(first);

    await first;
    expect(fade.opacity()).toBe(0);
    expect(fade.blocksInput()).toBe(true);
  });

  it('re-runs the fade-in when the entry key changes (component reuse)', async () => {
    const key = signal('story-a');
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(true), key),
    );
    TestBed.tick();

    await fade.fadeOut();
    expect(fade.opacity()).toBe(0);

    key.set('story-b');
    TestBed.tick();

    expect(fade.opacity()).toBe(1);
    expect(fade.ready()).toBe(true);
  });
});

describe('createChromeIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals the chrome on a pointerdown inside the top hover zone', () => {
    const idle = TestBed.runInInjectionContext(() => createChromeIdle(signal(undefined)));

    vi.advanceTimersByTime(3000);
    expect(idle()).toBe(true);

    document.dispatchEvent(new MouseEvent('pointerdown', { clientY: 10 }));
    expect(idle()).toBe(false);
  });

  it('ignores a pointerdown below the hover zone so an advance tap never pins the chrome open', () => {
    const idle = TestBed.runInInjectionContext(() => createChromeIdle(signal(undefined)));

    vi.advanceTimersByTime(3000);
    expect(idle()).toBe(true);

    document.dispatchEvent(new MouseEvent('pointerdown', { clientY: 600 }));
    expect(idle()).toBe(true);
  });
});
