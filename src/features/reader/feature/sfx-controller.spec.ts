import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SfxController } from './sfx-controller';

const URL_X = 'sfxX';

/**
 * Mock <audio> element for the one-shot SFX channel. `play()` resolves
 * on a microtask (mirroring HTMLMediaElement) and clears `ended`;
 * `finish()` models a clip reaching its natural end, where the element
 * is both `paused` and `ended`.
 */
class FakeAudio {
  src = '';
  volume = 0;
  loop = true;
  paused = true;
  ended = false;
  currentTime = 0;

  play = vi.fn((): Promise<void> => {
    return new Promise((resolve) => {
      queueMicrotask(() => {
        this.paused = false;
        this.ended = false;
        resolve();
      });
    });
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  load = vi.fn();
  removeAttribute = vi.fn();

  /** Mimic a one-shot clip playing through to its natural end. */
  finish(): void {
    this.paused = true;
    this.ended = true;
  }
}

describe('SfxController', () => {
  let slotA: FakeAudio;
  let slotB: FakeAudio;
  let controller: SfxController;
  let rafCallbacks: Array<(t: number) => void>;

  /** Settle the microtask scheduled by `play()`. */
  async function settlePlay(): Promise<void> {
    await Promise.resolve();
  }

  function playing(): FakeAudio | null {
    if (!slotA.paused) return slotA;
    if (!slotB.paused) return slotB;
    return null;
  }

  beforeEach(() => {
    slotA = new FakeAudio();
    slotB = new FakeAudio();
    rafCallbacks = [];
    // The fade ramp uses requestAnimationFrame; capture frames so the
    // controller never touches a real rAF loop during tests.
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      const idx = id - 1;
      if (idx >= 0 && idx < rafCallbacks.length) rafCallbacks[idx] = () => {};
    });
    controller = new SfxController(
      slotA as unknown as HTMLAudioElement,
      slotB as unknown as HTMLAudioElement,
    );
    controller.setUserVolume(1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('construction', () => {
    it('marks both slots one-shot (no loop) and silent', () => {
      expect(slotA.loop).toBe(false);
      expect(slotB.loop).toBe(false);
      expect(slotA.volume).toBe(0);
      expect(slotB.volume).toBe(0);
    });
  });

  describe('setTarget', () => {
    it('plays the resolved clip from the start', async () => {
      controller.setTarget(URL_X, 1);
      await settlePlay();
      const live = playing();
      expect(live).not.toBeNull();
      expect(live!.src).toBe(URL_X);
      expect(live!.currentTime).toBe(0);
    });
  });

  describe('unblock()', () => {
    it('does not replay a clip that has finished playing', async () => {
      // Bug guard: a finished one-shot clip is `paused` *and* `ended`.
      // The page keeps a lifetime `pointerdown` listener that calls
      // unblock() on every click — a stray click must not seek the
      // finished clip back to zero and replay the sound.
      controller.setTarget(URL_X, 1);
      await settlePlay();
      const live = playing()!;
      live.finish();
      const callsBefore = live.play.mock.calls.length;

      controller.unblock();
      await settlePlay();

      expect(live.play.mock.calls.length).toBe(callsBefore);
      expect(live.paused).toBe(true);
    });

    it('retries a clip whose autoplay was blocked', async () => {
      // First play() is rejected (no user gesture yet); the element
      // stays paused at the start — `ended` is false — so unblock()
      // must still retry it.
      slotA.play = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(new Error('NotAllowedError')))
        .mockImplementation((): Promise<void> => {
          return new Promise((resolve) => {
            queueMicrotask(() => {
              slotA.paused = false;
              resolve();
            });
          });
        });

      controller.setTarget(URL_X, 1);
      await settlePlay();
      expect(slotA.paused).toBe(true);
      expect(slotA.ended).toBe(false);

      controller.unblock();
      await settlePlay();

      expect(slotA.paused).toBe(false);
      expect(slotA.play).toHaveBeenCalledTimes(2);
    });

    it('does not restart an already-playing clip', async () => {
      controller.setTarget(URL_X, 1);
      await settlePlay();
      const live = playing()!;
      const callsBefore = live.play.mock.calls.length;

      controller.unblock();
      controller.unblock();
      await settlePlay();

      expect(live.play.mock.calls.length).toBe(callsBefore);
      expect(live.paused).toBe(false);
    });
  });
});
