import { describe, expect, it } from 'vitest';
import { STORED_CAP_BYTES, assertByteCap, assertUniverseCap } from '../src/quotas';

describe('STORED_CAP_BYTES', () => {
  it('matches the spec table exactly', () => {
    expect(STORED_CAP_BYTES).toEqual({
      cover: 2_621_440,
      background: 2_621_440,
      sprite: 5_242_880,
      ambient: 15_728_640,
      sfx: 3_145_728,
    });
  });
});

describe('assertByteCap', () => {
  it('accepts a byteLength exactly at the kind cap', () => {
    expect(() => assertByteCap('cover', STORED_CAP_BYTES.cover)).not.toThrow();
    expect(() => assertByteCap('ambient', STORED_CAP_BYTES.ambient)).not.toThrow();
  });

  it('rejects a byteLength one byte over the kind cap', () => {
    expect(() => assertByteCap('cover', STORED_CAP_BYTES.cover + 1)).toThrow(/too large/i);
    expect(() => assertByteCap('sfx', STORED_CAP_BYTES.sfx + 1)).toThrow(/too large/i);
  });
});

describe('assertUniverseCap', () => {
  it('accepts when adding byteLength keeps storage under 500 MB and count under 500', () => {
    expect(() =>
      assertUniverseCap({ storageBytes: 0, assetCount: 0, byteLength: 1024 }),
    ).not.toThrow();
    expect(() =>
      assertUniverseCap({
        storageBytes: 500 * 1024 * 1024 - 1024,
        assetCount: 499,
        byteLength: 1024,
      }),
    ).not.toThrow();
  });

  it('rejects when storage would exceed 500 MB', () => {
    expect(() =>
      assertUniverseCap({
        storageBytes: 500 * 1024 * 1024 - 100,
        assetCount: 1,
        byteLength: 200,
      }),
    ).toThrow(/storage/i);
  });

  it('rejects when assetCount is already 500', () => {
    expect(() =>
      assertUniverseCap({ storageBytes: 0, assetCount: 500, byteLength: 1 }),
    ).toThrow(/asset count/i);
  });
});
