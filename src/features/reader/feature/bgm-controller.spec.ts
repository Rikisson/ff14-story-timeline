import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BgmController } from './bgm-controller';

const URL_X = 'urlX';
const URL_Y = 'urlY';
const URL_Z = 'urlZ';

/**
 * Mock <audio> element. `play()` resolves on a microtask so it mirrors
 * HTMLMediaElement: a `pause()` arriving before the resolve rejects the
 * promise with AbortError and keeps the element paused. See
 * https://developer.chrome.com/blog/play-request-was-interrupted/.
 */
class FakeAudio {
  src = '';
  volume = 0;
  loop = false;
  paused = true;
  private pendingPlay: { resolve: () => void; reject: (e: Error) => void } | null = null;

  play = vi.fn((): Promise<void> => {
    return new Promise((resolve, reject) => {
      this.pendingPlay = { resolve, reject };
      queueMicrotask(() => {
        if (!this.pendingPlay) return;
        const settle = this.pendingPlay;
        this.pendingPlay = null;
        this.paused = false;
        settle.resolve();
      });
    });
  });

  pause = vi.fn(() => {
    if (this.pendingPlay) {
      const pending = this.pendingPlay;
      this.pendingPlay = null;
      pending.reject(new Error('AbortError'));
    }
    this.paused = true;
  });

  load = vi.fn();
  removeAttribute = vi.fn();
}

describe('BgmController', () => {
  let slotA: FakeAudio;
  let slotB: FakeAudio;
  let controller: BgmController;
  let now: number;
  let rafCallbacks: Array<(t: number) => void>;

  /**
   * Drive the controller's recursive `requestAnimationFrame` ramp by
   * stepping the virtual clock and invoking each newly queued frame.
   */
  function flushRaf(advanceMs: number): void {
    const stepMs = 16;
    const steps = Math.ceil(advanceMs / stepMs);
    for (let i = 0; i < steps; i++) {
      now += stepMs;
      const pending = rafCallbacks;
      rafCallbacks = [];
      for (const cb of pending) cb(now);
    }
  }

  /** Run a fixed number of frames — used to freeze the controller mid-ramp. */
  function partialFlush(frames: number): void {
    flushRaf(frames * 16);
  }

  /** Settle the microtask scheduled by `play()`. */
  async function settlePlay(): Promise<void> {
    await Promise.resolve();
  }

  /**
   * Slot-agnostic accessors. The controller ping-pongs between A and B
   * across scene changes; tests assert on behavior (which track is
   * audible) without pinning the physical slot.
   */
  function playing(): FakeAudio | null {
    if (!slotA.paused) return slotA;
    if (!slotB.paused) return slotB;
    return null;
  }
  function idle(): FakeAudio {
    if (slotA.paused && slotB.paused) throw new Error('both slots idle');
    return slotA.paused ? slotA : slotB;
  }

  beforeEach(() => {
    slotA = new FakeAudio();
    slotB = new FakeAudio();
    now = 0;
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      const idx = id - 1;
      if (idx >= 0 && idx < rafCallbacks.length) rafCallbacks[idx] = () => {};
    });
    controller = new BgmController(
      slotA as unknown as HTMLAudioElement,
      slotB as unknown as HTMLAudioElement,
    );
    controller.setUserVolume(1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('construction', () => {
    it('marks both slots looping and silent', () => {
      expect(slotA.loop).toBe(true);
      expect(slotB.loop).toBe(true);
      expect(slotA.volume).toBe(0);
      expect(slotB.volume).toBe(0);
    });
  });

  describe('first scene from idle', () => {
    it('null target leaves both slots untouched', async () => {
      controller.setTarget({ assetId: null, transition: 'crossfade' }, null);
      await settlePlay();
      flushRaf(900);
      expect(slotA.play).not.toHaveBeenCalled();
      expect(slotB.play).not.toHaveBeenCalled();
      expect(slotA.paused).toBe(true);
      expect(slotB.paused).toBe(true);
    });

    it('crossfade target ramps from 0 to user volume', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();

      partialFlush(10);
      const live = playing();
      expect(live).not.toBeNull();
      expect(live!.src).toBe(URL_X);
      expect(live!.volume).toBeGreaterThan(0);
      expect(live!.volume).toBeLessThan(1);

      flushRaf(900);
      expect(live!.volume).toBeCloseTo(1, 2);
    });

    it('cut target starts at full user volume immediately', async () => {
      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      expect(playing()!.src).toBe(URL_X);
      expect(playing()!.volume).toBeCloseTo(1, 2);
    });
  });

  describe('same-URL retarget (story-default inheritance)', () => {
    it('does not call play() again when consecutive scenes resolve to the same URL', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);
      const live = playing()!;
      const callsBefore = live.play.mock.calls.length;

      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();

      expect(live.play.mock.calls.length).toBe(callsBefore);
      expect(live.volume).toBeCloseTo(1, 2);
      expect(live.paused).toBe(false);
    });
  });

  describe('URL → silence', () => {
    it('crossfade fades the current slot to 0 and pauses it', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);
      const live = playing()!;

      controller.setTarget({ assetId: null, transition: 'crossfade' }, null);
      flushRaf(500);
      expect(live.paused).toBe(true);
      expect(live.volume).toBeCloseTo(0, 2);
    });

    it('cut pauses the current slot immediately with no ramp', async () => {
      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      const live = playing()!;

      controller.setTarget({ assetId: null, transition: 'cut' }, null);
      expect(live.paused).toBe(true);
      expect(live.volume).toBe(0);
    });
  });

  describe('URL → different URL', () => {
    it('crossfade brings the other slot up and pauses the old one at the end of the ramp', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);

      controller.setTarget({ assetId: 'Y', transition: 'crossfade' }, URL_Y);
      await settlePlay();
      flushRaf(900);

      expect(playing()!.src).toBe(URL_Y);
      expect(playing()!.volume).toBeCloseTo(1, 2);
      expect(idle().paused).toBe(true);
      expect(idle().volume).toBeCloseTo(0, 2);
    });

    it('cut hard-swaps with no ramp', async () => {
      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      const first = playing()!;

      controller.setTarget({ assetId: 'Y', transition: 'cut' }, URL_Y);
      await settlePlay();

      expect(first.paused).toBe(true);
      expect(first.volume).toBe(0);
      expect(playing()!.src).toBe(URL_Y);
      expect(playing()!.volume).toBeCloseTo(1, 2);
    });
  });

  describe('rapid navigation never orphans a slot', () => {
    // The reader must guarantee that fast scene-stepping never leaves a
    // previous track audible. Every interrupted transition must clean up
    // its outgoing slot — directly via the new ramp's onDone, or via the
    // same-URL cancel path when the next scene inherits the URL that was
    // being faded in.

    it('X → Y → X (crossfade chain mid-flight) keeps only the final track', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);

      controller.setTarget({ assetId: 'Y', transition: 'crossfade' }, URL_Y);
      await settlePlay();
      partialFlush(8);

      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);

      expect(playing()!.src).toBe(URL_X);
      expect(playing()!.volume).toBeCloseTo(1, 2);
      expect(idle().paused).toBe(true);
      expect(idle().volume).toBeCloseTo(0, 2);
    });

    it('same-URL retarget while crossfading toward that URL pauses the orphan', async () => {
      // Regression: cancelling a mid-flight crossfade because the next
      // scene inherits the URL being faded IN used to skip the onDone
      // that pauses the outgoing slot, leaving both tracks audible.
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);

      controller.setTarget({ assetId: 'Y', transition: 'crossfade' }, URL_Y);
      await settlePlay();
      flushRaf(900);

      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      partialFlush(5);

      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);

      expect(playing()!.src).toBe(URL_X);
      expect(playing()!.volume).toBeCloseTo(1, 2);
      expect(idle().paused).toBe(true);
      expect(idle().volume).toBeCloseTo(0, 2);
    });

    it('X → Y → X → Y rapid ping-pong leaves only the final track playing', async () => {
      const steps: Array<[string, string]> = [
        ['X', URL_X],
        ['Y', URL_Y],
        ['X', URL_X],
        ['Y', URL_Y],
      ];
      for (let i = 0; i < steps.length - 1; i++) {
        const [id, url] = steps[i];
        controller.setTarget({ assetId: id, transition: 'crossfade' }, url);
        await settlePlay();
        partialFlush(5);
      }
      const [finalId, finalUrl] = steps[steps.length - 1];
      controller.setTarget({ assetId: finalId, transition: 'crossfade' }, finalUrl);
      await settlePlay();
      flushRaf(900);

      expect(playing()!.src).toBe(URL_Y);
      expect(playing()!.volume).toBeCloseTo(1, 2);
      expect(idle().paused).toBe(true);
      expect(idle().volume).toBeCloseTo(0, 2);
    });

    it('crossfade interrupted by a cut to a third URL leaves no orphan', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);

      controller.setTarget({ assetId: 'Y', transition: 'crossfade' }, URL_Y);
      await settlePlay();
      partialFlush(5);

      controller.setTarget({ assetId: 'Z', transition: 'cut' }, URL_Z);
      await settlePlay();

      expect(playing()!.src).toBe(URL_Z);
      expect(playing()!.volume).toBeCloseTo(1, 2);
      expect(idle().paused).toBe(true);
      expect(idle().volume).toBeCloseTo(0, 2);
    });

    it('mid-fadeout to silence is reversed when the same URL returns', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);
      const live = playing()!;

      controller.setTarget({ assetId: null, transition: 'crossfade' }, null);
      partialFlush(5);
      expect(live.volume).toBeLessThan(1);

      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      flushRaf(900);

      expect(live.paused).toBe(false);
      expect(live.volume).toBeCloseTo(1, 2);
    });

    it('different URL arriving mid-fadeout takes over and pauses the old slot', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);

      controller.setTarget({ assetId: null, transition: 'crossfade' }, null);
      partialFlush(3);

      controller.setTarget({ assetId: 'Y', transition: 'crossfade' }, URL_Y);
      await settlePlay();
      flushRaf(900);

      expect(playing()!.src).toBe(URL_Y);
      expect(playing()!.volume).toBeCloseTo(1, 2);
      expect(idle().paused).toBe(true);
      expect(idle().volume).toBeCloseTo(0, 2);
    });
  });

  describe('user volume', () => {
    it('clamps to [0, 1] and treats NaN as 0', async () => {
      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      const live = playing()!;

      controller.setUserVolume(2);
      expect(live.volume).toBeCloseTo(1, 2);

      controller.setUserVolume(-0.5);
      expect(live.volume).toBe(0);

      controller.setUserVolume(Number.NaN);
      expect(live.volume).toBe(0);
    });

    it('mid-crossfade changes affect the rising slot but never raise the fading slot', async () => {
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);
      const oldSlot = playing()!;

      controller.setTarget({ assetId: 'Y', transition: 'crossfade' }, URL_Y);
      await settlePlay();
      partialFlush(10);
      const oldMidVol = oldSlot.volume;
      expect(oldMidVol).toBeGreaterThan(0);
      expect(oldMidVol).toBeLessThan(1);

      controller.setUserVolume(0.25);
      partialFlush(1);
      // The fading slot's start-volume was captured when the ramp began;
      // user-volume changes must not jolt it back up.
      expect(oldSlot.volume).toBeLessThanOrEqual(oldMidVol);

      flushRaf(900);
      expect(playing()!.volume).toBeCloseTo(0.25, 2);
    });
  });

  describe('dispose', () => {
    it('pauses both slots and clears their sources', async () => {
      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();

      controller.dispose();

      expect(slotA.paused).toBe(true);
      expect(slotB.paused).toBe(true);
      expect(slotA.removeAttribute).toHaveBeenCalledWith('src');
      expect(slotB.removeAttribute).toHaveBeenCalledWith('src');
      expect(slotA.load).toHaveBeenCalled();
      expect(slotB.load).toHaveBeenCalled();
    });
  });

  describe('autoplay policy', () => {
    /**
     * Mimic a browser that has not yet seen a user gesture: the first
     * `play()` rejects with NotAllowedError, subsequent calls succeed.
     */
    function rejectFirstPlay(audio: FakeAudio): void {
      audio.play = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('NotAllowedError')))
        .mockImplementation((): Promise<void> => {
          return new Promise((resolve) => {
            queueMicrotask(() => {
              audio.paused = false;
              resolve();
            });
          });
        });
    }

    it('retries play on unblock() after a blocked autoplay attempt', async () => {
      rejectFirstPlay(slotA);

      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      expect(slotA.paused).toBe(true);
      expect(slotA.play).toHaveBeenCalledTimes(1);

      controller.unblock();
      await settlePlay();

      expect(slotA.paused).toBe(false);
      expect(slotA.play).toHaveBeenCalledTimes(2);
    });

    it('retries play on a same-URL setTarget after a blocked autoplay attempt', async () => {
      rejectFirstPlay(slotA);

      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      expect(slotA.paused).toBe(true);

      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();

      expect(slotA.paused).toBe(false);
      expect(slotA.play).toHaveBeenCalledTimes(2);
    });

    it('unblock() is a no-op when no playback was blocked', async () => {
      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      const live = playing()!;
      const callsBefore = live.play.mock.calls.length;

      controller.unblock();
      await settlePlay();

      expect(live.play.mock.calls.length).toBe(callsBefore);
    });

    it('story-default BGM recovers on scene navigation when the initial play was blocked', async () => {
      // Page-reload symptom: the autoplay-unblock gesture listener
      // fires before the controller has been constructed (during the
      // initial story-loading interval), so no `unblock()` is called.
      // The controller is then created in a non-gesture microtask and
      // its first `play()` is rejected. With a story-level-only BGM,
      // every subsequent scene resolves to the same URL — the same-URL
      // branch must notice the paused slot and retry on its own.
      rejectFirstPlay(slotA);

      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();
      flushRaf(900);
      expect(slotA.paused).toBe(true);
      expect(slotA.volume).toBeCloseTo(1, 2);

      // Next scene inherits the same story-level URL — no unblock() in
      // between, just a same-URL retarget.
      controller.setTarget({ assetId: 'X', transition: 'crossfade' }, URL_X);
      await settlePlay();

      expect(slotA.paused).toBe(false);
      expect(slotA.volume).toBeCloseTo(1, 2);
    });

    it('unblock() can be called repeatedly without restarting an already-playing slot', async () => {
      // The page-level gesture listener now stays subscribed for the
      // lifetime of the page, so unblock() fires on every pointer/key
      // event. Once the slot is playing, those extra calls must be
      // no-ops — otherwise audio would stutter on every interaction.
      controller.setTarget({ assetId: 'X', transition: 'cut' }, URL_X);
      await settlePlay();
      const live = playing()!;
      const callsBefore = live.play.mock.calls.length;

      controller.unblock();
      controller.unblock();
      controller.unblock();
      await settlePlay();

      expect(live.play.mock.calls.length).toBe(callsBefore);
      expect(live.paused).toBe(false);
    });
  });
});
