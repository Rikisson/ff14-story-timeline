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
  const onReveal = (): void => {
    idle.set(false);
    startHideTimer();
  };
  // Gate the tap reveal to the header's hover zone so an advance tap on
  // the scene or a choice never pins the header open; a key press has no
  // position to gate on and stays the unconditional keyboard reveal.
  const onPointerDown = (e: MouseEvent): void => {
    if (e.clientY <= hoverZone()) onReveal();
  };
  startHideTimer();
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('keydown', onReveal, { passive: true });
  inject(DestroyRef).onDestroy(() => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('keydown', onReveal);
  });
  return idle.asReadonly();
}

const ENTER_FADE_MS = 1500;
export const EXIT_FADE_MS = 700;
export const REDUCED_MOTION_EXIT_MS = 300;

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

  // Angular reuses a routed component when only its route params change,
  // so a same-route continuation keeps this instance; re-run the fade-in
  // on each later entry instead of relying on the construction-time one.
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

export function registerAutoplayUnblock(unblock: () => void): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  document.addEventListener('pointerdown', unblock, true);
  document.addEventListener('keydown', unblock, true);
  inject(DestroyRef).onDestroy(() => {
    document.removeEventListener('pointerdown', unblock, true);
    document.removeEventListener('keydown', unblock, true);
  });
}
