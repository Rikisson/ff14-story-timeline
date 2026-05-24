import { describe, expect, it } from 'vitest';
import { initializeApp } from 'firebase/app';
import { doc, getFirestore } from 'firebase/firestore/lite';
import { assetDeleteTxBody, uploadCommitTxBody } from './media-assets.tx';
import type { StoredAsset } from './asset.types';

function makeOfflineFirestore(name: string) {
  const app = initializeApp({ projectId: 'unit-test' }, name);
  return getFirestore(app);
}

interface FakeIncrement {
  __increment: number;
}
function isIncrement(v: unknown): v is FakeIncrement {
  return typeof v === 'object' && v !== null && '__increment' in v;
}

function makeFakeTx(store: Map<string, Record<string, unknown>>) {
  return {
    async get(ref: { path: string }) {
      const data = store.get(ref.path);
      return {
        exists: () => data !== undefined,
        data: () => data,
      };
    },
    set(ref: { path: string }, data: Record<string, unknown>) {
      store.set(ref.path, data);
    },
    update(ref: { path: string }, patch: Record<string, unknown>) {
      const current = store.get(ref.path) ?? {};
      const next = { ...current };
      for (const [k, v] of Object.entries(patch)) {
        if (isIncrement(v)) {
          const prev = typeof current[k] === 'number' ? (current[k] as number) : 0;
          next[k] = prev + v.__increment;
        } else {
          next[k] = v;
        }
      }
      store.set(ref.path, next);
    },
    delete(ref: { path: string }) {
      store.delete(ref.path);
    },
  };
}

function fakeIncrement(n: number): FakeIncrement {
  return { __increment: n };
}

const sampleStored: StoredAsset = {
  kind: 'cover',
  url: 'https://r2/u1/cover/a1/x.webp',
  thumbUrl: 'https://r2/u1/cover/a1/x.thumb.webp',
  label: 'Hero',
  authorUid: 'uid-1',
  objects: [
    { key: 'universes/u1/cover/a1/x.webp', bytes: 1000 },
    { key: 'universes/u1/cover/a1/x.thumb.webp', bytes: 200 },
  ],
  totalBytes: 1200,
  createdAt: 100,
};

describe('uploadCommitTxBody', () => {
  it('writes the asset doc and bumps universe counters by totalBytes / +1', async () => {
    const firestore = makeOfflineFirestore(`upload-commit-${Date.now()}`);
    const assetRef = doc(firestore, 'universes', 'u1', '_assets', 'a1');
    const universeRef = doc(firestore, 'universes', 'u1');
    const store = new Map<string, Record<string, unknown>>([
      ['universes/u1', { storageBytes: 5000, assetCount: 3, deletedAt: null }],
    ]);
    const fakeTx = makeFakeTx(store);

    await uploadCommitTxBody(
      fakeTx as never,
      { assetRef, universeRef },
      sampleStored,
      fakeIncrement,
    );

    expect(store.get('universes/u1/_assets/a1')).toEqual(sampleStored);
    expect(store.get('universes/u1')).toMatchObject({
      storageBytes: 6200,
      assetCount: 4,
    });
  });
});

describe('assetDeleteTxBody', () => {
  it("deletes the asset doc and decrements counters by the doc's own totalBytes", async () => {
    const firestore = makeOfflineFirestore(`asset-delete-${Date.now()}`);
    const assetRef = doc(firestore, 'universes', 'u1', '_assets', 'a1');
    const universeRef = doc(firestore, 'universes', 'u1');
    const store = new Map<string, Record<string, unknown>>([
      ['universes/u1', { storageBytes: 6200, assetCount: 4, deletedAt: null }],
      ['universes/u1/_assets/a1', sampleStored as unknown as Record<string, unknown>],
    ]);
    const fakeTx = makeFakeTx(store);

    await assetDeleteTxBody(fakeTx as never, { assetRef, universeRef }, fakeIncrement);

    expect(store.has('universes/u1/_assets/a1')).toBe(false);
    expect(store.get('universes/u1')).toMatchObject({
      storageBytes: 5000,
      assetCount: 3,
    });
  });

  it('is a no-op when the asset doc does not exist (idempotent retry safety)', async () => {
    const firestore = makeOfflineFirestore(`asset-delete-noop-${Date.now()}`);
    const assetRef = doc(firestore, 'universes', 'u1', '_assets', 'a1');
    const universeRef = doc(firestore, 'universes', 'u1');
    const store = new Map<string, Record<string, unknown>>([
      ['universes/u1', { storageBytes: 6200, assetCount: 4, deletedAt: null }],
    ]);
    const fakeTx = makeFakeTx(store);

    await assetDeleteTxBody(fakeTx as never, { assetRef, universeRef }, fakeIncrement);

    expect(store.get('universes/u1')).toMatchObject({
      storageBytes: 6200,
      assetCount: 4,
    });
  });
});
