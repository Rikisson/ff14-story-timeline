import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let getDocsMock: ReturnType<typeof vi.fn>;

vi.mock('firebase/firestore/lite', () => {
  return {
    collection: (..._args: unknown[]) => ({ kind: 'collection', args: _args }),
    doc: (..._args: unknown[]) => ({ kind: 'doc', args: _args }),
    documentId: () => ({ kind: 'documentId' }),
    query: (..._args: unknown[]) => ({ kind: 'query', args: _args }),
    where: (..._args: unknown[]) => ({ kind: 'where', args: _args }),
    getDocs: (...args: unknown[]) => (getDocsMock as (...a: unknown[]) => unknown)(...args),
  };
});

import { AssetThumbResolver } from './asset-thumb-resolver.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';
import { FirebaseService } from '../../app/firebase/firebase.service';
import { UniverseStore } from '@features/universes';

interface FakeAssetDoc {
  id: string;
  url: string;
  thumbUrl?: string;
}

function fakeSnap(docs: FakeAssetDoc[]) {
  return {
    docs: docs.map((d) => ({ id: d.id, data: () => d })),
  };
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
      { provide: FirebaseService, useValue: { firestore: {} } },
      { provide: UniverseStore, useValue: { activeUniverseId: activeSignal } },
    ],
  });
  return {
    resolver: TestBed.inject(AssetThumbResolver),
    bus: TestBed.inject(CacheInvalidationBus),
  };
}

beforeEach(() => {
  getDocsMock = vi.fn().mockResolvedValue(fakeSnap([]));
});

describe('AssetThumbResolver', () => {
  it('returns a stable null signal for empty / null inputs without fetching', () => {
    const { resolver } = setup();
    expect(resolver.resolve(undefined)()).toBeNull();
    expect(resolver.resolve(null)()).toBeNull();
    expect(resolver.resolve('')()).toBeNull();
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('returns a null signal while the fetch is in flight, then updates when the batch resolves', async () => {
    getDocsMock.mockResolvedValueOnce(
      fakeSnap([{ id: 'a1', url: 'https://r2/a1', thumbUrl: 'https://r2/a1.thumb' }]),
    );
    const { resolver } = setup();

    const sig = resolver.resolve('a1');
    expect(sig()).toBeNull();

    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    expect(sig()).toEqual({ id: 'a1', url: 'https://r2/a1', thumbUrl: 'https://r2/a1.thumb' });
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('batches multiple cache misses into a single getDocs call', async () => {
    getDocsMock.mockResolvedValueOnce(
      fakeSnap([
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

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(sigs[0]()).toMatchObject({ id: 'a1' });
    expect(sigs[1]()).toMatchObject({ id: 'a2' });
    expect(sigs[2]()).toMatchObject({ id: 'a3' });
  });

  it('returns the cached signal without re-fetching on repeated resolves', async () => {
    getDocsMock.mockResolvedValueOnce(fakeSnap([{ id: 'a1', url: 'u1' }]));
    const { resolver } = setup();

    const first = resolver.resolve('a1');
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();

    const second = resolver.resolve('a1');
    expect(second()).toEqual(first());
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('chunks an in-query when more than 30 IDs are queued in one microtask', async () => {
    getDocsMock
      .mockResolvedValueOnce(fakeSnap([]))
      .mockResolvedValueOnce(fakeSnap([]));
    const { resolver } = setup();

    for (let i = 0; i < 31; i++) resolver.resolve(`id${i}`);
    await flushMicrotasks();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to null when the fetched batch omits an ID (asset missing)', async () => {
    getDocsMock.mockResolvedValueOnce(fakeSnap([{ id: 'a1', url: 'u1' }]));
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
    getDocsMock
      .mockResolvedValueOnce(fakeSnap([{ id: 'a1', url: 'first' }]))
      .mockResolvedValueOnce(fakeSnap([{ id: 'a1', url: 'second' }]));
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
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('ignores bus events for ids the cache never saw', async () => {
    const { bus } = setup();
    bus.publishAssetWrite({ universeId: 'u1', assetId: 'unknown' });
    await flushMicrotasks();
    expect(getDocsMock).not.toHaveBeenCalled();
  });
});
