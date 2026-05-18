import { BgmTransition } from '@features/stories';
import { BgmTarget } from '../data-access/bgm';

const CROSSFADE_MS = 800;
const SILENCE_FADE_MS = 400;

type Slot = 'a' | 'b';

/**
 * Drives two `<audio>` elements as a BGM crossfade pair. The audio host
 * lives at the player-page shell level (above `scene-view`) so the same
 * physical `<audio>` element persists across scene changes — when
 * consecutive scenes resolve to the same BGM URL the element is left
 * playing untouched and the browser does not restart it.
 *
 * Cross-scene transitions fall into four shapes:
 *   - same URL: no-op (lazy-mode "inherit").
 *   - URL → null silence: ramp current slot to 0 (crossfade) or pause
 *     immediately (cut).
 *   - null silence → URL: bring up a fresh slot at 0 → userVolume
 *     (crossfade) or directly at userVolume (cut).
 *   - URL → different URL: bring up the other slot at 0 → userVolume,
 *     ramp the previous slot toward 0 (crossfade), or hard-swap (cut).
 *
 * A user volume change mid-ramp updates the active slot in place; the
 * fading slot continues toward zero unaffected.
 */
export class BgmController {
  private current: { slot: Slot; url: string } | null = null;
  private userVolume = 0;
  private rafId: number | null = null;
  /**
   * Set to `true` when an autoplay attempt was rejected. Most browsers
   * block `<audio>.play()` until the tab has received a user gesture;
   * if the first scene's BGM hits this branch we remember it and retry
   * on the next gesture (see `unblock()`) so lazy stories with one
   * track-across-the-whole-thing still play once the user clicks.
   */
  private wantsPlay = false;

  constructor(
    private readonly slotA: HTMLAudioElement,
    private readonly slotB: HTMLAudioElement,
  ) {
    slotA.loop = true;
    slotB.loop = true;
    slotA.volume = 0;
    slotB.volume = 0;
  }

  setUserVolume(v: number): void {
    this.userVolume = clamp01(v);
    if (this.rafId !== null) return;
    // No ramp running: drive the active slot directly. The other slot is
    // already paused/zeroed from the most recent transition.
    if (this.current) this.elFor(this.current.slot).volume = this.userVolume;
  }

  setTarget(target: BgmTarget, resolvedUrl: string | null): void {
    if (this.current?.url === resolvedUrl && resolvedUrl !== null) {
      if (this.rafId !== null) {
        // Mid-fadeout to silence on this URL — cancel and bring back to user volume.
        this.cancelRamp();
        this.elFor(this.current.slot).volume = this.userVolume;
        return;
      }
      // Same URL, no ramp in flight. Retry play() if a previous autoplay
      // attempt was blocked so a deferred user gesture can resurrect it.
      if (this.wantsPlay) this.tryPlay(this.elFor(this.current.slot));
      return;
    }
    if (resolvedUrl === null) {
      if (this.current === null) return;
      this.fadeOut(target.transition);
      return;
    }
    this.fadeIn(resolvedUrl, target.transition);
  }

  dispose(): void {
    this.cancelRamp();
    for (const el of [this.slotA, this.slotB]) {
      try {
        el.pause();
      } catch {
        // ignore — disposing.
      }
      el.removeAttribute('src');
      el.load();
    }
    this.current = null;
    this.wantsPlay = false;
  }

  /**
   * Called from the player page on the first user gesture (pointer or
   * key). If a prior `play()` was rejected by the autoplay policy, the
   * `wantsPlay` flag is still set; retrying inside a real gesture frame
   * succeeds.
   */
  unblock(): void {
    if (!this.wantsPlay || !this.current) return;
    this.tryPlay(this.elFor(this.current.slot));
  }

  private fadeOut(transition: BgmTransition): void {
    const cur = this.current;
    if (!cur) return;
    const el = this.elFor(cur.slot);
    if (transition === 'cut') {
      el.pause();
      el.volume = 0;
      this.current = null;
      this.cancelRamp();
      return;
    }
    const startVol = el.volume;
    this.runRamp({
      durationMs: SILENCE_FADE_MS,
      onTick: (t) => {
        el.volume = startVol * (1 - t);
      },
      onDone: () => {
        el.pause();
        el.volume = 0;
        this.current = null;
      },
    });
  }

  private fadeIn(url: string, transition: BgmTransition): void {
    const oldCur = this.current;
    const newSlot: Slot = oldCur?.slot === 'a' ? 'b' : 'a';
    const newEl = this.elFor(newSlot);
    const oldEl = oldCur ? this.elFor(oldCur.slot) : null;

    newEl.src = url;
    newEl.volume = transition === 'cut' ? this.userVolume : 0;
    this.tryPlay(newEl);

    if (transition === 'cut') {
      if (oldEl) {
        oldEl.pause();
        oldEl.volume = 0;
      }
      this.current = { slot: newSlot, url };
      this.cancelRamp();
      return;
    }

    const oldStartVol = oldEl?.volume ?? 0;
    this.current = { slot: newSlot, url };
    this.runRamp({
      durationMs: CROSSFADE_MS,
      onTick: (t) => {
        if (oldEl) oldEl.volume = oldStartVol * (1 - t);
        newEl.volume = this.userVolume * t;
      },
      onDone: () => {
        if (oldEl) {
          oldEl.pause();
          oldEl.volume = 0;
        }
      },
    });
  }

  private runRamp(opts: {
    durationMs: number;
    onTick: (t: number) => void;
    onDone: () => void;
  }): void {
    this.cancelRamp();
    let start: number | null = null;
    const tick = (now: number): void => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / opts.durationMs);
      opts.onTick(t);
      if (t >= 1) {
        this.rafId = null;
        opts.onDone();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private tryPlay(el: HTMLAudioElement): void {
    const result = el.play();
    if (!result || typeof result.then !== 'function') return;
    result.then(
      () => {
        this.wantsPlay = false;
      },
      () => {
        // Autoplay rejected (most browsers block playback until the tab
        // has received a user gesture). Remember the intent; `unblock()`
        // and same-URL setTarget calls will retry.
        this.wantsPlay = true;
      },
    );
  }

  private cancelRamp(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private elFor(slot: Slot): HTMLAudioElement {
    return slot === 'a' ? this.slotA : this.slotB;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
