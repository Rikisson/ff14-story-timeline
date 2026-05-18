const FADE_MS = 220;

type Slot = 'a' | 'b';

interface CurrentTrack {
  slot: Slot;
  url: string;
  /**
   * A monotonic counter that changes on every scene entry. Two visits
   * to the same scene (e.g., via back-nav) carry different keys, which
   * is what tells the controller "restart this SFX from zero" even when
   * the URL is identical.
   */
  key: number;
}

/**
 * Scene SFX / voice line channel. Same two-slot crossfade shape as
 * `BgmController` but tuned for one-shot semantics:
 *
 *   - No `loop` — clips play through and stop at their natural end.
 *   - Each scene entry is treated as "play this from the start."
 *     Re-entering a scene (back navigation) restarts the SFX even when
 *     the underlying asset is identical, distinguished by an external
 *     `key` the caller advances on every scene visit.
 *   - Fade is short (~220 ms) so transitions feel snappy. When the
 *     reader skips fast, the outgoing slot fades while the incoming
 *     slot fades in over the same window, in parallel.
 *   - Autoplay rejection is handled by the same `tryPlay()` / `unblock()`
 *     pattern `BgmController` uses, so an early-blocked first scene
 *     starts on the next user gesture.
 */
export class SfxController {
  private current: CurrentTrack | null = null;
  private userVolume = 0;
  private rafId: number | null = null;

  constructor(
    private readonly slotA: HTMLAudioElement,
    private readonly slotB: HTMLAudioElement,
  ) {
    for (const el of [slotA, slotB]) {
      el.loop = false;
      el.volume = 0;
    }
  }

  setUserVolume(v: number): void {
    this.userVolume = clamp01(v);
    if (this.rafId !== null) return;
    if (this.current) this.elFor(this.current.slot).volume = this.userVolume;
  }

  /**
   * Apply the resolved SFX target for the current scene visit. The
   * `key` distinguishes scene entries so a back-nav onto the same SFX
   * still retriggers playback from zero.
   */
  setTarget(resolvedUrl: string | null, key: number): void {
    if (resolvedUrl === null) {
      if (this.current === null) return;
      this.fadeOut();
      return;
    }
    if (
      this.current?.url === resolvedUrl &&
      this.current.key === key &&
      this.rafId === null
    ) {
      // Same URL, same scene visit, no ramp pending — playing or
      // already played out, nothing to do. If the slot is paused (e.g.,
      // the first play() was rejected by autoplay policy and never
      // recovered), retry on this gesture-adjacent call.
      const el = this.elFor(this.current.slot);
      if (el.paused) this.tryPlay(el);
      return;
    }
    this.fadeIn(resolvedUrl, key);
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

  /** Retry a blocked autoplay attempt on the active slot. */
  unblock(): void {
    if (!this.current) return;
    const el = this.elFor(this.current.slot);
    if (el.paused) this.tryPlay(el);
  }

  private fadeOut(): void {
    const cur = this.current;
    if (!cur) return;
    const el = this.elFor(cur.slot);
    const startVol = el.volume;
    this.runRamp({
      durationMs: FADE_MS,
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

  private fadeIn(url: string, key: number): void {
    const oldCur = this.current;
    const newSlot: Slot = oldCur?.slot === 'a' ? 'b' : 'a';
    const newEl = this.elFor(newSlot);
    const oldEl = oldCur ? this.elFor(oldCur.slot) : null;

    newEl.src = url;
    newEl.currentTime = 0;
    newEl.volume = 0;
    this.tryPlay(newEl);

    const oldStartVol = oldEl?.volume ?? 0;
    this.current = { slot: newSlot, url, key };
    this.runRamp({
      durationMs: FADE_MS,
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

  private tryPlay(el: HTMLAudioElement): void {
    const result = el.play();
    // play() returns a Promise per spec; some legacy paths return
    // undefined. Rejection (e.g., autoplay policy) leaves the element
    // paused, which `unblock()` and same-URL retargets detect and retry.
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        // ignore — paused state is the recovery signal.
      });
    }
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
