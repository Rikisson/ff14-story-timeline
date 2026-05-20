import { CanDeactivateFn } from '@angular/router';

/**
 * Implemented by the reader's story and event pages so the leave guard
 * can run their exit fade — visuals and audio — before the route is
 * destroyed.
 */
export interface ReaderLeavable {
  beginExit(): Promise<boolean>;
}

/**
 * CanDeactivate guard for the reader pages. Defers the navigation until
 * the page has faded its visuals and audio out, so leaving a reader —
 * for another story/event or back out entirely — never cuts abruptly.
 *
 * It always resolves `true`: the guard only delays, it never blocks. A
 * guard that rejected a `popstate` would force the router to restore the
 * URL (a visible flicker); always-true means a browser-back simply runs
 * the fade and proceeds.
 */
export const readerLeaveGuard: CanDeactivateFn<ReaderLeavable> = (component) =>
  component.beginExit();
