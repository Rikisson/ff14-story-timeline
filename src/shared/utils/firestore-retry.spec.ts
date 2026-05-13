import { FirebaseError } from 'firebase/app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryOnTransient } from './firestore-retry';

function fbError(code: string, message = code): FirebaseError {
  return new FirebaseError(code, message);
}

describe('retryOnTransient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns immediately when fn resolves on the first call', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await retryOnTransient(fn)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-Firebase errors without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network'));
    await expect(retryOnTransient(fn)).rejects.toThrow('network');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-transient FirebaseErrors without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(fbError('firestore/permission-denied'));
    await expect(retryOnTransient(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry failed-precondition without "index" in message', async () => {
    const fn = vi.fn().mockRejectedValue(fbError('firestore/failed-precondition', 'some other precondition'));
    await expect(retryOnTransient(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on firestore/unavailable and returns the eventual result', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(fbError('firestore/unavailable'))
      .mockResolvedValueOnce('ok');
    const promise = retryOnTransient(fn);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on firestore/deadline-exceeded', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(fbError('firestore/deadline-exceeded'))
      .mockResolvedValueOnce('ok');
    const promise = retryOnTransient(fn);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on failed-precondition when message contains "index"', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(fbError('firestore/failed-precondition', 'The query requires an index'))
      .mockResolvedValueOnce('ok');
    const promise = retryOnTransient(fn);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on failed-precondition with mixed-case "Index" in message', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(fbError('firestore/failed-precondition', 'Index not yet built'))
      .mockResolvedValueOnce('ok');
    const promise = retryOnTransient(fn);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after 5 total attempts for a persistent transient error', async () => {
    const fn = vi.fn().mockRejectedValue(fbError('firestore/unavailable'));
    const promise = retryOnTransient(fn);
    // Attach the rejection handler before advancing timers to avoid an unhandled rejection.
    const assertion = expect(promise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('succeeds on the last allowed attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(fbError('firestore/unavailable'))
      .mockRejectedValueOnce(fbError('firestore/unavailable'))
      .mockRejectedValueOnce(fbError('firestore/unavailable'))
      .mockRejectedValueOnce(fbError('firestore/unavailable'))
      .mockResolvedValueOnce('last');
    const promise = retryOnTransient(fn);
    await vi.runAllTimersAsync();
    expect(await promise).toBe('last');
    expect(fn).toHaveBeenCalledTimes(5);
  });
});
