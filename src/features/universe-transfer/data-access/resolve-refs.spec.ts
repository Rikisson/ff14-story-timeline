import { describe, expect, it } from 'vitest';
import {
  KindSlugMap,
  resolveArchiveRef,
  rewriteInlineTokensToIds,
  rewriteInlineTokensToSlugs,
  toArchiveRef,
} from './resolve-refs';

function emptyMap(): KindSlugMap {
  return {
    character: new Map(),
    place: new Map(),
    event: new Map(),
    story: new Map(),
    plotline: new Map(),
    codexEntry: new Map(),
  };
}

describe('resolveArchiveRef', () => {
  it('resolves a slug to an id', () => {
    const map = emptyMap();
    map.character.set('eldrin', 'id-1');
    expect(resolveArchiveRef({ kind: 'character', ref: 'eldrin' }, map)).toEqual({
      kind: 'character',
      id: 'id-1',
    });
  });

  it('returns null for an unknown slug', () => {
    expect(resolveArchiveRef({ kind: 'character', ref: 'nobody' }, emptyMap())).toBeNull();
  });
});

describe('toArchiveRef', () => {
  it('resolves an id back to a slug', () => {
    const map = emptyMap();
    map.place.set('id-2', 'old-harbor');
    expect(toArchiveRef({ kind: 'place', id: 'id-2' }, map)).toEqual({
      kind: 'place',
      ref: 'old-harbor',
    });
  });
});

describe('rewriteInlineTokensToIds', () => {
  it('rewrites a slug token to an id token', () => {
    const map = emptyMap();
    map.character.set('eldrin', 'id-1');
    expect(rewriteInlineTokensToIds('Hi ${ch:eldrin}[Eldrin]!', map)).toBe(
      'Hi ${ch:id-1}[Eldrin]!',
    );
  });

  it('collapses an unresolved token to its display text', () => {
    expect(rewriteInlineTokensToIds('Hi ${ch:ghost}[Ghost]!', emptyMap())).toBe('Hi Ghost!');
  });
});

describe('rewriteInlineTokensToSlugs', () => {
  it('rewrites an id token back to a slug token', () => {
    const map = emptyMap();
    map.character.set('id-1', 'eldrin');
    expect(rewriteInlineTokensToSlugs('Hi ${ch:id-1}[Eldrin]!', map)).toBe(
      'Hi ${ch:eldrin}[Eldrin]!',
    );
  });
});
