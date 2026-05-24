import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_AUDIO_SECONDS,
  assertAudioDuration,
  readAudioDurationSeconds,
} from './audio-duration';

function fakeAudioFile(): File {
  return new File([new Uint8Array(8)], 'sample.ogg', { type: 'audio/ogg' });
}

class StubAudio {
  src = '';
  preload = '';
  duration = NaN;
  private handlers: Record<string, Array<() => void>> = {};
  addEventListener(evt: string, fn: () => void): void {
    (this.handlers[evt] ||= []).push(fn);
  }
  removeEventListener(_evt: string, _fn: () => void): void {
    // no-op for the stub
  }
  fire(evt: string): void {
    for (const h of this.handlers[evt] ?? []) h();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubAudio(duration: number, fireError = false): StubAudio {
  const a = new StubAudio();
  vi.stubGlobal(
    'Audio',
    class {
      constructor() {
        return a as unknown as StubAudio;
      }
    },
  );
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:x',
    revokeObjectURL: () => undefined,
  });
  queueMicrotask(() => {
    if (fireError) {
      a.fire('error');
    } else {
      a.duration = duration;
      a.fire('loadedmetadata');
    }
  });
  return a;
}

describe('readAudioDurationSeconds', () => {
  it('resolves with the duration reported by Audio metadata', async () => {
    stubAudio(42.5);
    const seconds = await readAudioDurationSeconds(fakeAudioFile());
    expect(seconds).toBeCloseTo(42.5);
  });

  it('rejects when metadata fails to load', async () => {
    stubAudio(0, true);
    await expect(readAudioDurationSeconds(fakeAudioFile())).rejects.toThrow(/duration/i);
  });
});

describe('assertAudioDuration', () => {
  it('exposes the spec caps', () => {
    expect(MAX_AUDIO_SECONDS).toEqual({ ambient: 600, sfx: 60 });
  });

  it('accepts ambient at exactly 600s', () => {
    expect(() => assertAudioDuration('ambient', 600)).not.toThrow();
  });

  it('rejects ambient over 600s', () => {
    expect(() => assertAudioDuration('ambient', 600.1)).toThrow(/too long/i);
  });

  it('accepts sfx at exactly 60s', () => {
    expect(() => assertAudioDuration('sfx', 60)).not.toThrow();
  });

  it('rejects sfx over 60s', () => {
    expect(() => assertAudioDuration('sfx', 60.1)).toThrow(/too long/i);
  });
});
