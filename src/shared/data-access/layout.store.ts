import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';

interface LayoutState {
  /**
   * Hides the app's own chrome (top header + the refresh-error banner).
   * Independent of the browser's native fullscreen — a page can hide our
   * header without going fullscreen, and the browser can be fullscreen
   * (F11) without us hiding the header.
   */
  chromeHidden: boolean;
  /**
   * Mirror of `document.fullscreenElement` for any element we requested.
   * Kept in sync via a global `fullscreenchange` listener so Esc / F11
   * exits flip this back to `false` without the caller needing to know.
   */
  browserFullscreen: boolean;
}

const initialState: LayoutState = {
  chromeHidden: false,
  browserFullscreen: false,
};

export const LayoutStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setChromeHidden(hidden: boolean): void {
      patchState(store, { chromeHidden: hidden });
    },
    /**
     * Enter native fullscreen on the given element (defaults to the
     * document root) and hide the app chrome together. Must be called
     * from a user gesture; the browser rejects programmatic requests.
     */
    async enterFullscreen(target: Element = document.documentElement): Promise<void> {
      patchState(store, { chromeHidden: true });
      try {
        await target.requestFullscreen();
      } catch (err) {
        // Browser refused (no user gesture, sandboxed iframe, etc.) —
        // roll back the chrome state so the UI doesn't look broken.
        patchState(store, { chromeHidden: false });
        throw err;
      }
    },
    /**
     * Exit native fullscreen if active and unhide chrome. Safe to call
     * unconditionally; the `fullscreenchange` listener also handles
     * Esc / F11 exits.
     */
    async exitFullscreen(): Promise<void> {
      patchState(store, { chromeHidden: false });
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // Ignore — exit failure leaves the chromeChange listener to
          // reconcile on the next user-driven exit.
        }
      }
    },
  })),
  withHooks((store) => {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    return {
      onInit() {
        if (!isBrowser) return;
        document.addEventListener('fullscreenchange', () => {
          const active = !!document.fullscreenElement;
          patchState(store, {
            browserFullscreen: active,
            // If the user exited via Esc / F11 while our chrome was
            // hidden, unhide it. Entering doesn't auto-hide chrome —
            // the caller decides via `enterFullscreen` or
            // `setChromeHidden` separately.
            chromeHidden: active ? store.chromeHidden() : false,
          });
        });
      },
    };
  }),
);
