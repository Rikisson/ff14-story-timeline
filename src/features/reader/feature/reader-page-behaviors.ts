import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  Signal,
  signal,
} from '@angular/core';

// Cross-cutting behaviors shared by the story and event reader pages.
// Each is a factory called from a page's injection context (a field
// initializer or the constructor); it owns its own listeners/timers and
// cleans them up via `DestroyRef`. Extracted so the two readers stay in
// lockstep by construction rather than by copy-paste.

/**
 * OS-level reduced-motion preference as a signal. Reads `matchMedia`
 * once and tracks live changes so enabling reduced motion mid-session
 * takes effect without a reload. Server-side it stays `false`. Call
 * from an injection context.
 */
export function createReducedMotion(): Signal<boolean> {
  const reduced = signal(false);
  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.set(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => reduced.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
  }
  return reduced.asReadonly();
}

/**
 * Mirrors `source`, but holds a `false → true` transition back by
 * `delayMs` so a fast resolve never flashes the flag; `true → false`
 * applies immediately. Drives the reader's delay-gated "Loading…" line.
 * Call from an injection context.
 */
export function createDeferredFlag(source: Signal<boolean>, delayMs = 500): Signal<boolean> {
  const flag = signal(false);
  let pending: ReturnType<typeof setTimeout> | null = null;
  effect(() => {
    const active = source();
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    if (active) {
      flag.set(false);
      pending = setTimeout(() => {
        flag.set(true);
        pending = null;
      }, delayMs);
    } else {
      flag.set(false);
    }
  });
  inject(DestroyRef).onDestroy(() => {
    if (pending !== null) clearTimeout(pending);
  });
  return flag.asReadonly();
}

const CHROME_IDLE_MS = 2500;
const FALLBACK_HOVER_PX = 82;

/**
 * Idle-fade state for the reader's floating header. The header shows on
 * mount, then hides after 2.5s of no pointer/key activity; it re-appears
 * while the pointer sits in the top hover zone (the header card plus its
 * own top padding mirrored below) and instantly on any tap or key press
 * — the only way to reach it on touch/keyboard devices. Returns the
 * `idle` signal: `true` means faded out. Server-side it stays visible.
 * Call from an injection context.
 */
export function createChromeIdle(
  headerEl: Signal<ElementRef<HTMLElement> | undefined>,
): Signal<boolean> {
  const idle = signal(false);
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return idle.asReadonly();

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const startHideTimer = (): void => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => idle.set(true), CHROME_IDLE_MS);
  };
  // Hover zone spans the header card and an equal pad above and below,
  // so the pointer can rest anywhere over the card without arming the
  // hide timer. Falls back to a fixed height until the header mounts.
  const hoverZone = (): number => {
    const el = headerEl()?.nativeElement;
    if (!el) return FALLBACK_HOVER_PX;
    const rect = el.getBoundingClientRect();
    const topPad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    return rect.bottom + topPad;
  };
  const onMouseMove = (e: MouseEvent): void => {
    if (e.clientY <= hoverZone()) {
      idle.set(false);
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    } else if (!idle() && idleTimer === null) {
      startHideTimer();
    }
  };
  // A tap or key press re-shows the chrome, then the idle timer hides
  // it again — the only way to reach the header on a touch or keyboard
  // device, where `mousemove` never fires.
  const onReveal = (): void => {
    idle.set(false);
    startHideTimer();
  };
  startHideTimer();
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('pointerdown', onReveal, { passive: true });
  document.addEventListener('keydown', onReveal, { passive: true });
  inject(DestroyRef).onDestroy(() => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerdown', onReveal);
    document.removeEventListener('keydown', onReveal);
  });
  return idle.asReadonly();
}

// Reader page fade-in duration on entry.
const ENTER_FADE_MS = 1500;
// Reader page fade-out duration on exit — visuals and audio share it.
export const EXIT_FADE_MS = 700;
// Exit hold under OS reduced motion: visuals cut instantly, but the
// audio still fades over this shorter window so it never pops.
export const REDUCED_MOTION_EXIT_MS = 300;

/**
 * Page-level fade transition for a reader page. The page binds these
 * signals to a wrapper around its content; the content fades as one
 * over the page's static `bg-canvas` root. Fading the content — rather
 * than compositing a canvas-colored layer on top of it — keeps an
 * imageless scene seam-free: nothing canvas-colored is ever inside an
 * opacity-animated compositing layer, so there is no faint mismatch
 * against the static background.
 *
 *  - `opacity` / `durationMs` drive the content wrapper's CSS opacity
 *    fade — `opacity` is 1 fully visible, 0 fully faded to the canvas.
 *  - `blocksInput` is true whenever the wrapper should drop pointer
 *    events — during a fade-in and the whole exit fade — so a tap can't
 *    reach a choice or skip the typewriter mid-transition.
 *  - `ready` flips true when a fade-in completes; the page feeds it to
 *    `scene-view` as the typewriter reveal gate.
 *  - `fadeOut()` fades the content out and resolves when done; the
 *    leave guard awaits it before navigating away.
 *
 * `entryKey` is the page's route-param signal. Angular reuses a routed
 * component when only its params change, so a story→story or
 * event→event continuation keeps the same page instance — the
 * constructor-time fade-in would run only once and leave the content
 * stuck faded out. Each later `entryKey` change re-runs the fade-in. A
 * story↔event continuation crosses route configs and gets a fresh
 * component (and fade) the ordinary way.
 *
 * Honors reduced motion and SSR by skipping the animation outright.
 * Call from an injection context.
 */
export interface ReaderFade {
  readonly opacity: Signal<number>;
  readonly durationMs: Signal<number>;
  readonly ready: Signal<boolean>;
  readonly blocksInput: Signal<boolean>;
  fadeOut(): Promise<void>;
}

export function createReaderFade(
  reducedMotion: Signal<boolean>,
  entryKey: Signal<unknown>,
): ReaderFade {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  const animate = isBrowser && !reducedMotion();

  const opacity = signal(animate ? 0 : 1);
  const durationMs = signal(animate ? ENTER_FADE_MS : 0);
  const ready = signal(!animate);
  const blocksInput = computed(() => !ready() || opacity() !== 1);

  const timers = new Set<ReturnType<typeof setTimeout>>();
  let rafId: number | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let exit: Promise<void> | null = null;

  const schedule = (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  // Fade the content from the canvas base in to fully visible, opening
  // `ready` once it lands. Drives the first fade-in and every re-entry;
  // cancels a pending fade-in timer so a rapid re-entry can't open
  // `ready` early.
  const fadeIn = (): void => {
    if (readyTimer !== null) {
      clearTimeout(readyTimer);
      timers.delete(readyTimer);
      readyTimer = null;
    }
    if (!animate) {
      durationMs.set(0);
      opacity.set(1);
      ready.set(true);
      return;
    }
    durationMs.set(ENTER_FADE_MS);
    opacity.set(1);
    ready.set(false);
    readyTimer = schedule(() => {
      readyTimer = null;
      ready.set(true);
    }, ENTER_FADE_MS);
  };

  // First fade-in: the wrapper just rendered at opacity 0, so hold one
  // painted frame before animating it in.
  if (animate) {
    afterNextRender(() => {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        fadeIn();
      });
    });
  }

  // Re-entry: Angular kept this component for a same-route continuation.
  // The first effect run is the initial mount (faded in above); each
  // later run is a new story/event — fade the content back in and clear
  // the exit latch for the next leave.
  let firstEntry = true;
  effect(() => {
    entryKey();
    if (firstEntry) {
      firstEntry = false;
      return;
    }
    exit = null;
    fadeIn();
  });

  inject(DestroyRef).onDestroy(() => {
    for (const id of timers) clearTimeout(id);
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  const fadeOut = (): Promise<void> => {
    if (exit) return exit;
    if (!isBrowser || reducedMotion()) {
      durationMs.set(0);
      opacity.set(0);
      exit = Promise.resolve();
      return exit;
    }
    durationMs.set(EXIT_FADE_MS);
    opacity.set(0);
    exit = new Promise<void>((resolve) => schedule(resolve, EXIT_FADE_MS));
    return exit;
  };

  return {
    opacity: opacity.asReadonly(),
    durationMs: durationMs.asReadonly(),
    ready: ready.asReadonly(),
    blocksInput,
    fadeOut,
  };
}

/**
 * Routes every user gesture to `unblock`. Browsers reject `play()`
 * until the tab has been interacted with; the listeners stay live for
 * the page's lifetime so any gesture — not just the first — can recover
 * audio whose controller was built outside a gesture frame. Capture
 * phase so it runs ahead of app handlers. Call from an injection
 * context.
 */
export function registerAutoplayUnblock(unblock: () => void): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  document.addEventListener('pointerdown', unblock, true);
  document.addEventListener('keydown', unblock, true);
  inject(DestroyRef).onDestroy(() => {
    document.removeEventListener('pointerdown', unblock, true);
    document.removeEventListener('keydown', unblock, true);
  });
}
