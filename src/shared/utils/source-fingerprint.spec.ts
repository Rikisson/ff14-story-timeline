import { describe, expect, it } from 'vitest';
import { computeSourceFingerprint } from './source-fingerprint';

describe('computeSourceFingerprint', () => {
  it('produces a 12-character hex string', async () => {
    const fp = await computeSourceFingerprint({ label: 'Hello' });
    expect(fp).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic across object-key insertion order', async () => {
    const a = await computeSourceFingerprint({ a: 1, b: 2, c: 3 });
    const b = await computeSourceFingerprint({ c: 3, a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('sorts string arrays so reordering does not change the hash', async () => {
    const a = await computeSourceFingerprint({ ids: ['x', 'a', 'm'] });
    const b = await computeSourceFingerprint({ ids: ['a', 'm', 'x'] });
    expect(a).toBe(b);
  });

  it('treats undefined, null, and missing keys as equivalent', async () => {
    const present = await computeSourceFingerprint({ label: 'x', tag: null });
    const absent = await computeSourceFingerprint({ label: 'x' });
    const undef = await computeSourceFingerprint({ label: 'x', tag: undefined });
    expect(present).toBe(absent);
    expect(undef).toBe(absent);
  });

  it('treats an empty array as equivalent to an absent field', async () => {
    const empty = await computeSourceFingerprint({ label: 'x', ids: [] });
    const absent = await computeSourceFingerprint({ label: 'x' });
    expect(empty).toBe(absent);
  });

  it('treats an empty string as equivalent to an absent field', async () => {
    const empty = await computeSourceFingerprint({ label: 'x', note: '' });
    const absent = await computeSourceFingerprint({ label: 'x' });
    expect(empty).toBe(absent);
  });

  it('NFC-normalises strings so precomposed and decomposed forms hash equally', async () => {
    const nfc = 'Café'.normalize('NFC');
    const nfd = 'Café'.normalize('NFD');
    const a = await computeSourceFingerprint({ label: nfc });
    const b = await computeSourceFingerprint({ label: nfd });
    expect(a).toBe(b);
  });

  it('trims surrounding whitespace on string values', async () => {
    const a = await computeSourceFingerprint({ label: 'hello' });
    const b = await computeSourceFingerprint({ label: '  hello  ' });
    expect(a).toBe(b);
  });

  it('preserves the order of object arrays (sequence-meaningful)', async () => {
    const a = await computeSourceFingerprint({
      scenes: [{ id: 'a' }, { id: 'b' }],
    });
    const b = await computeSourceFingerprint({
      scenes: [{ id: 'b' }, { id: 'a' }],
    });
    expect(a).not.toBe(b);
  });

  it('changes when a string value changes', async () => {
    const a = await computeSourceFingerprint({ label: 'Hello' });
    const b = await computeSourceFingerprint({ label: 'World' });
    expect(a).not.toBe(b);
  });

  it('hashes a representative projection slice deterministically', async () => {
    const slice = {
      kind: 'story',
      entityId: 'story-1',
      label: 'The Lightning Day',
      labelFolded: 'the lightning day',
      slug: 'the-lightning-day',
      coverAssetId: 'asset-7',
      visiblePublic: true,
      characterIds: ['ch-2', 'ch-1', 'ch-3'],
      placeIds: [],
      categoryKey: undefined,
      draft: false,
    };
    const a = await computeSourceFingerprint(slice);
    const b = await computeSourceFingerprint({
      ...slice,
      characterIds: ['ch-3', 'ch-1', 'ch-2'],
      placeIds: undefined,
    });
    expect(a).toBe(b);
  });
});
