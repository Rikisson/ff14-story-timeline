import { describe, expect, it } from 'vitest';
import {
  chunkInto,
  collectAssetKeys,
  SUBCOLLECTIONS_TO_DELETE,
} from './universe-deletion.helpers';

describe('chunkInto', () => {
  it('returns an empty array for an empty input', () => {
    expect(chunkInto([], 50)).toEqual([]);
  });

  it('returns a single chunk when input fits in one batch', () => {
    expect(chunkInto([1, 2, 3], 50)).toEqual([[1, 2, 3]]);
  });

  it('splits at the exact chunk boundary', () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    expect(chunkInto(input, 50)).toEqual([input]);
  });

  it('splits a 51-item array into two chunks of 50 + 1', () => {
    const input = Array.from({ length: 51 }, (_, i) => i);
    const out = chunkInto(input, 50);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(50);
    expect(out[1]).toEqual([50]);
  });

  it('throws on a non-positive chunk size', () => {
    expect(() => chunkInto([1], 0)).toThrow(/chunk size/i);
    expect(() => chunkInto([1], -1)).toThrow(/chunk size/i);
  });
});

describe('collectAssetKeys', () => {
  it('flattens objects[] from every asset doc', () => {
    const assets = [
      { objects: [{ key: 'a', bytes: 1 }, { key: 'a.thumb', bytes: 1 }] },
      { objects: [{ key: 'b', bytes: 1 }] },
    ];
    expect(collectAssetKeys(assets)).toEqual(['a', 'a.thumb', 'b']);
  });

  it('skips assets missing the objects field (defensive against old/partial docs)', () => {
    const assets = [
      { objects: [{ key: 'a', bytes: 1 }] },
      {} as unknown as { objects: { key: string; bytes: number }[] },
    ];
    expect(collectAssetKeys(assets)).toEqual(['a']);
  });
});

describe('SUBCOLLECTIONS_TO_DELETE', () => {
  it('covers every per-universe subcollection used by the app', () => {
    expect(new Set(SUBCOLLECTIONS_TO_DELETE)).toEqual(
      new Set([
        'characters',
        'places',
        'events',
        'plotlines',
        'codexEntries',
        '_directory',
        '_timelineEntries',
        '_timelineLaneEntries',
        '_slugIndex',
        '_meta',
      ]),
    );
  });

  it('does not include `stories` or `_assets` (handled by dedicated walkers)', () => {
    expect(SUBCOLLECTIONS_TO_DELETE).not.toContain('stories');
    expect(SUBCOLLECTIONS_TO_DELETE).not.toContain('_assets');
  });
});
