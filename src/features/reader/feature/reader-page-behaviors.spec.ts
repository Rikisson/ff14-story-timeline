import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { createReaderFade } from './reader-page-behaviors';

describe('createReaderFade', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('starts fully covering and input-blocking before the fade-in runs', () => {
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(false), signal('story-a')),
    );

    // Overlay sits at full surface; the reveal gate is closed and the
    // overlay swallows input until the entry fade-in completes.
    expect(fade.opacity()).toBe(1);
    expect(fade.ready()).toBe(false);
    expect(fade.blocksInput()).toBe(true);
  });

  it('skips the fade-in under reduced motion: overlay starts clear and ready', () => {
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(true), signal('story-a')),
    );

    expect(fade.opacity()).toBe(0);
    expect(fade.ready()).toBe(true);
    expect(fade.blocksInput()).toBe(false);
  });

  it('fadeOut() raises the overlay back to full surface, and is idempotent', async () => {
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(true), signal('story-a')),
    );

    const first = fade.fadeOut();
    // A second call returns the same in-flight promise — the guard can
    // be invoked twice for one navigation without restarting the fade.
    expect(fade.fadeOut()).toBe(first);

    await first;
    expect(fade.opacity()).toBe(1);
    expect(fade.blocksInput()).toBe(true);
  });

  it('re-runs the fade-in when the entry key changes (component reuse)', async () => {
    // A story→story / event→event continuation reuses the routed
    // component, so the constructor-time fade-in never re-runs — without
    // re-entry handling the guard's surface overlay stays a blank wall.
    const key = signal('story-a');
    const fade = TestBed.runInInjectionContext(() =>
      createReaderFade(signal(true), key),
    );
    // First effect run records the initial entry.
    TestBed.tick();

    // The leave guard lifts the overlay to full surface...
    await fade.fadeOut();
    expect(fade.opacity()).toBe(1);

    // ...then Angular reuses this component for the next story/event.
    key.set('story-b');
    TestBed.tick();

    // The overlay is lifted again — not left covering the new content.
    expect(fade.opacity()).toBe(0);
    expect(fade.ready()).toBe(true);
  });
});
