import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetDocsFetcher } from './asset-docs-fetcher.service';
import { AssetThumb, AssetThumbResolver } from './asset-thumb-resolver.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';
import { UniverseStore } from '@features/universes';

let fetchMock: ReturnType<typeof vi.fn>;

function makeAssets(rows: Array<Partial<AssetThumb> & { id: string }>): Map<string, AssetThumb> {
  const out = new Map<string, AssetThumb>();
  for (const r of rows) {
    out.set(r.id, { url: `url-${r.id}`, ...r });
  }
  return out;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

function setup(activeUniverseId: string | null = 'u1') {
  const activeSignal = signal<string | null>(activeUniverseId);
  TestBed.configureTestingModule({
    providers: [
      AssetThumbResolver,
      CacheInvalidationBus,
      { provide: AssetDocsFetcher, useValue: { fetchAssets: fetchMock } },
      { provide: UniverseStore, useValue: { activeUniverseId: activeSignal } },
    ],
  });
  return {
    resolver: TestBed.inject(AssetThumbResolver),
    bus: TestBed.inject(CacheInvalidationBus),
  };
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Map());
});

describe('AssetThumbResolver', () => {
  it('returns a stable null signal for empty / null inputs without fetching', () => {
    const { resolver } = setup();
    expect(resolver.resolve(undefined)()).toBeNull();
    expect(resolver.resolve(null)()).toBeNull();
    expect(resolver.resolve('')()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns undefined while the fetch is in flight, then updates when the batch resolves', async () => {
    fetchMock.mockResolvedValueOnce(
      makeAssets([{ id: 'a1', url: 'https://r2/a1', thumbUrl: 'https://r2/a1.thumb' }]),
    );
    const { resolver } = setup();

    const sig = resolver.resolve('a1');
    // `undefined` = pending; the consumer (lazy-thumb, timeline-tile)
    // distinguishes it from `null` (resolved-missing) to stop showing a
    // skeleton on deleted assets.
    expect(sig()).toBeUndefined();

    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    expect(sig()).toEqual({ id: 'a1', url: 'https://r2/a1', thumbUrl: 'https://r2/a1.thumb' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('settles a missing asset id at null so consumers stop showing the pending skeleton', async () => {
    fetchMock.mockResolvedValueOnce(new Map());
    const { resolver } = setup();

    const sig = resolver.resolve('deleted-asset');
    expect(sig()).toBeUndefined();

    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    expect(sig()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('batches multiple cache misses into a single fetch call', async () => {
    fetchMock.mockResolvedValueOnce(
      makeAssets([
        { id: 'a1', url: 'u1' },
        { id: 'a2', url: 'u2' },
        { id: 'a3', url: 'u3' },
      ]),
    );
    const { resolver } = setup();

    const sigs = ['a1', 'a2', 'a3'].map((id) => resolver.resolve(id));
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sigs[0]()).toMatchObject({ id: 'a1' });
    expect(sigs[1]()).toMatchObject({ id: 'a2' });
    expect(sigs[2]()).toMatchObject({ id: 'a3' });
  });

  it('returns the cached signal without re-fetching on repeated resolves', async () => {
    fetchMock.mockResolvedValueOnce(makeAssets([{ id: 'a1', url: 'u1' }]));
    const { resolver } = setup();

    const first = resolver.resolve('a1');
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    const second = resolver.resolve('a1');
    expect(second()).toEqual(first());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('chunks the fetch when more than 30 IDs are queued in one microtask', async () => {
    fetchMock
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map());
    const { resolver } = setup();

    for (let i = 0; i < 31; i++) resolver.resolve(`id${i}`);
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to null when the fetched batch omits an ID (asset missing)', async () => {
    fetchMock.mockResolvedValueOnce(makeAssets([{ id: 'a1', url: 'u1' }]));
    const { resolver } = setup();

    const present = resolver.resolve('a1');
    const missing = resolver.resolve('a-missing');
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    expect(present()).toMatchObject({ id: 'a1' });
    expect(missing()).toBeNull();
  });

  it('re-queues a fetch when the bus publishes an asset-write for a cached id', async () => {
    fetchMock
      .mockResolvedValueOnce(makeAssets([{ id: 'a1', url: 'first' }]))
      .mockResolvedValueOnce(makeAssets([{ id: 'a1', url: 'second' }]));
    const { resolver, bus } = setup();

    const sig = resolver.resolve('a1');
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();
    expect(sig()?.url).toBe('first');

    bus.publishAssetWrite({ universeId: 'u1', assetId: 'a1' });
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    expect(sig()?.url).toBe('second');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores bus events for ids the cache never saw', async () => {
    const { bus } = setup();
    bus.publishAssetWrite({ universeId: 'u1', assetId: 'unknown' });
    await flushMicrotasks();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
