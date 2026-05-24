import { describe, expect, it } from 'vitest';
import { parseBulkDeleteBody, parseDeleteBody, parseSignBody } from '../src/parse-body';

const goodSign = {
  universeId: 'u_1',
  kind: 'cover',
  assetId: 'a_1',
  filename: 'hero.webp',
  byteLength: 12345,
};

describe('parseSignBody', () => {
  it('accepts a valid body', () => {
    expect(parseSignBody(goodSign)).toEqual(goodSign);
  });

  it('rejects missing byteLength', () => {
    const { byteLength: _omit, ...rest } = goodSign;
    expect(() => parseSignBody(rest)).toThrow(/byteLength/i);
  });

  it('rejects non-integer byteLength', () => {
    expect(() => parseSignBody({ ...goodSign, byteLength: 12.5 })).toThrow(/byteLength/i);
  });

  it('rejects byteLength <= 0', () => {
    expect(() => parseSignBody({ ...goodSign, byteLength: 0 })).toThrow(/byteLength/i);
    expect(() => parseSignBody({ ...goodSign, byteLength: -1 })).toThrow(/byteLength/i);
  });

  it('rejects unknown kind', () => {
    expect(() => parseSignBody({ ...goodSign, kind: 'haxx' })).toThrow(/kind/i);
  });

  it('rejects path-traversal filename', () => {
    expect(() => parseSignBody({ ...goodSign, filename: '..' })).toThrow(/filename/i);
    expect(() => parseSignBody({ ...goodSign, filename: '/etc/passwd' })).toThrow(/filename/i);
  });

  it('rejects invalid universeId characters', () => {
    expect(() => parseSignBody({ ...goodSign, universeId: 'has space' })).toThrow(/universeId/i);
  });
});

describe('parseDeleteBody', () => {
  it('accepts a valid body without byteLength', () => {
    const { byteLength: _omit, ...del } = goodSign;
    expect(parseDeleteBody(del)).toEqual(del);
  });
});

describe('parseBulkDeleteBody', () => {
  it('accepts up to 50 valid keys', () => {
    const keys = Array.from(
      { length: 50 },
      (_, i) => `universes/u_1/cover/a_${i}/hero.webp`,
    );
    const out = parseBulkDeleteBody({ universeId: 'u_1', keys });
    expect(out.keys.length).toBe(50);
  });

  it('rejects > 50 keys', () => {
    const keys = Array.from(
      { length: 51 },
      (_, i) => `universes/u_1/cover/a_${i}/hero.webp`,
    );
    expect(() => parseBulkDeleteBody({ universeId: 'u_1', keys })).toThrow(/50/);
  });

  it('rejects empty keys', () => {
    expect(() => parseBulkDeleteBody({ universeId: 'u_1', keys: [] })).toThrow(/empty/);
  });

  it('rejects a key whose universeId does not match the body', () => {
    expect(() =>
      parseBulkDeleteBody({
        universeId: 'u_1',
        keys: ['universes/u_2/cover/a_1/hero.webp'],
      }),
    ).toThrow(/mismatch/);
  });

  it('rejects malformed key paths', () => {
    expect(() =>
      parseBulkDeleteBody({ universeId: 'u_1', keys: ['some/random/path'] }),
    ).toThrow(/Invalid key/);
  });
});
