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
      const cur = this.current;
      const curEl = this.elFor(cur.slot);
      if (this.rafId !== null) {
        // A ramp is mid-flight and the same URL is being re-targeted.
        // Two shapes land here:
        //   - fadeOut to silence on the current slot (other slot already idle).
        //   - crossfade where the current slot is fading IN this URL and the
        //     OTHER slot is fading out an old track. Cancelling the ramp
        //     skips its onDone, so we must pause the orphan ourselves —
        //     otherwise both tracks keep playing.
        this.cancelRamp();
        const otherEl = this.elFor(cur.slot === 'a' ? 'b' : 'a');
        otherEl.pause();
        otherEl.volume = 0;
        curEl.volume = this.userVolume;
        if (curEl.paused) this.tryPlay(curEl);
        return;
      }
      // Same URL, no ramp in flight. If the slot is paused — typically
      // because the first play() was rejected by the browser's autoplay
      // policy and never recovered — retry now. `el.paused` is the
      // synchronous source of truth; the alternative (tracking a flag
      // set inside the async play() promise) can drift out of sync with
      // the element's real state.
      if (curEl.paused) this.tryPlay(curEl);
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
  }

  /**
   * Called from the player page on every user gesture (pointer or
   * key). If the active slot is paused — typically because the initial
   * `play()` was rejected by the browser's autoplay policy — retrying
   * inside a real gesture frame succeeds.
   */
  unblock(): void {
    if (!this.current) return;
    const el = this.elFor(this.current.slot);
    if (el.paused) this.tryPlay(el);
  }

  /**
   * Ramp both slots to silence over `durationMs`, then pause them and
   * resolve. Used by the reader page's exit transition so leaving a
   * story/event fades the music out instead of cutting it dead on page
   * teardown. Both slots are ramped so a crossfade caught mid-flight
   * doesn't leave the outgoing track audible. A no-op (resolves
   * immediately) when nothing is playing.
   */
  fadeOutAndStop(durationMs: number): Promise<void> {
    if (this.current === null) return Promise.resolve();
    const aStart = this.slotA.volume;
    const bStart = this.slotB.volume;
    return new Promise<void>((resolve) => {
      this.runRamp({
        durationMs,
        onTick: (t) => {
          this.slotA.volume = aStart * (1 - t);
          this.slotB.volume = bStart * (1 - t);
        },
        onDone: () => {
          for (const el of [this.slotA, this.slotB]) {
            el.pause();
            el.volume = 0;
          }
          this.current = null;
          resolve();
        },
      });
    });
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
    // Some legacy browsers return undefined from play(); the standard
    // returns a Promise we can swallow. Rejection (e.g., autoplay
    // policy) is recovered later via `unblock()` or a same-URL retarget
    // — both branches check `el.paused` and retry as needed.
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        // ignore — paused state is the recovery signal.
      });
    }
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
