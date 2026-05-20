import { isPlatformBrowser } from '@angular/common';
import {
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
