import { EntityRef } from '@shared/models';
import {
  buildInlineRef,
  isRefSegment,
  parseRefs,
  resolveRef,
} from './inline-refs';

describe('parseRefs', () => {
  it('returns a single literal segment when no tokens are present', () => {
    const segments = parseRefs('Hello, world.');
    expect(segments).toEqual([{ literal: 'Hello, world.' }]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseRefs('')).toEqual([]);
  });

  it('parses character, place, event, and story tokens', () => {
    const text =
      'Met ${ch:abc-1}[the hyur] at ${pl:gri}[Gridania] during ${ev:cal}[the Calamity], from ${st:s1}[the tale].';
    const segments = parseRefs(text);
    const refs = segments.filter(isRefSegment).map((s) => s.ref);
    expect(refs).toEqual([
      { kind: 'character', id: 'abc-1' },
      { kind: 'place', id: 'gri' },
      { kind: 'event', id: 'cal' },
      { kind: 'story', id: 's1' },
    ] satisfies EntityRef[]);
  });

  it('splits literals and refs in order with empty display text allowed', () => {
    const segments = parseRefs('a${ch:x}[]b${pl:y}[Y]c');
    expect(segments).toEqual([
      { literal: 'a' },
      { ref: { kind: 'character', id: 'x' }, displayText: '', raw: '${ch:x}[]' },
      { literal: 'b' },
      { ref: { kind: 'place', id: 'y' }, displayText: 'Y', raw: '${pl:y}[Y]' },
      { literal: 'c' },
    ]);
  });

  it('ignores malformed tokens', () => {
    const segments = parseRefs('${unknown:1}[x] ${ch:}[y] ${ch:ok}[z]');
    const refs = segments.filter(isRefSegment).map((s) => s.ref);
    expect(refs).toEqual([{ kind: 'character', id: 'ok' }]);
  });
});

describe('buildInlineRef', () => {
  it('produces canonical token form', () => {
    expect(buildInlineRef('character', 'abc', 'name')).toBe('${ch:abc}[name]');
    expect(buildInlineRef('place', 'pid')).toBe('${pl:pid}[]');
  });
});

describe('resolveRef', () => {
  it('accepts a function lookup', () => {
    const out = resolveRef(
      { kind: 'character', id: 'abc' },
      (r) => (r.id === 'abc' ? 'Alice' : undefined),
    );
    expect(out).toBe('Alice');
  });

  it('accepts a lookup object', () => {
    const out = resolveRef(
      { kind: 'place', id: 'gri' },
      { resolve: () => 'Gridania' },
    );
    expect(out).toBe('Gridania');
  });
});
