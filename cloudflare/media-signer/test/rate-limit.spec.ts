import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_REQUESTS_PER_MINUTE, checkRateLimit } from '../src/rate-limit';

interface KVRecord {
  value: string;
  expiresAt?: number;
}

function fakeKV() {
  const store = new Map<string, KVRecord>();
  return {
    async get(key: string): Promise<string | null> {
      const rec = store.get(key);
      if (!rec) return null;
      if (rec.expiresAt && rec.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return rec.value;
    },
    async put(
      key: string,
      value: string,
      opts?: { expirationTtl?: number },
    ): Promise<void> {
      const expiresAt = opts?.expirationTtl
        ? Date.now() + opts.expirationTtl * 1000
        : undefined;
      store.set(key, { value, expiresAt });
    },
    _peek(key: string): KVRecord | undefined {
      return store.get(key);
    },
  };
}

describe('checkRateLimit', () => {
  let kv: ReturnType<typeof fakeKV>;
  let now: number;

  beforeEach(() => {
    kv = fakeKV();
    now = Date.UTC(2026, 4, 24, 12, 0, 0);
  });

  it('exposes the spec cap of 30/min', () => {
    expect(MAX_REQUESTS_PER_MINUTE).toBe(30);
  });

  it('allows the first request', async () => {
    const ok = await checkRateLimit(kv as never, 'uid-1', now);
    expect(ok).toBe(true);
  });

  it('allows up to MAX_REQUESTS_PER_MINUTE within the same minute', async () => {
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      const ok = await checkRateLimit(kv as never, 'uid-1', now);
      expect(ok).toBe(true);
    }
  });

  it('denies the (MAX+1)th request within the same minute', async () => {
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      await checkRateLimit(kv as never, 'uid-1', now);
    }
    const ok = await checkRateLimit(kv as never, 'uid-1', now);
    expect(ok).toBe(false);
  });

  it('resets when the minute bucket rolls over', async () => {
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      await checkRateLimit(kv as never, 'uid-1', now);
    }
    const nextMinute = now + 60_000;
    const ok = await checkRateLimit(kv as never, 'uid-1', nextMinute);
    expect(ok).toBe(true);
  });

  it('keys per UID', async () => {
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      await checkRateLimit(kv as never, 'uid-1', now);
    }
    const ok = await checkRateLimit(kv as never, 'uid-2', now);
    expect(ok).toBe(true);
  });
});
