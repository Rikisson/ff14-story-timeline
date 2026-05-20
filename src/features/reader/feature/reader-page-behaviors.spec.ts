import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { createReaderFade } from './reader-page-behaviors';

describe('createReaderFade', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('starts hidden and input-blocking before the fade-in runs', () => {
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(false), signal('story-a')),
    );

    // Content starts faded out over the canvas base; the reveal gate is
    // closed and the wrapper swallows input until the fade-in completes.
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
    // A second call returns the same in-flight promise — the guard can
    // be invoked twice for one navigation without restarting the fade.
    expect(fade.fadeOut()).toBe(first);

    await first;
    expect(fade.opacity()).toBe(0);
    expect(fade.blocksInput()).toBe(true);
  });

  it('re-runs the fade-in when the entry key changes (component reuse)', async () => {
    // A story→story / event→event continuation reuses the routed
    // component, so the constructor-time fade-in never re-runs — without
    // re-entry handling the content stays stuck faded out.
    const key = signal('story-a');
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(true), key),
    );
    // First effect run records the initial entry.
    TestBed.tick();

    // The leave guard fades the content out...
    await fade.fadeOut();
    expect(fade.opacity()).toBe(0);

    // ...then Angular reuses this component for the next story/event.
    key.set('story-b');
    TestBed.tick();

    // The content is faded back in — not left stuck hidden.
    expect(fade.opacity()).toBe(1);
    expect(fade.ready()).toBe(true);
  });
});
