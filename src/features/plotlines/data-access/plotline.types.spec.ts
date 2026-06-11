import { describe, expect, it } from 'vitest';
import { deriveMemberKeys, memberKeyOf, PlotlineMember } from './plotline.types';

describe('plotline member keys', () => {
  it('formats a member key as kind:id', () => {
    expect(memberKeyOf({ kind: 'story', id: 's1' })).toBe('story:s1');
    expect(memberKeyOf({ kind: 'event', id: 'e9' })).toBe('event:e9');
  });

  it('derives keys preserving member order', () => {
    const members: PlotlineMember[] = [
      { kind: 'event', id: 'e1' },
      { kind: 'story', id: 's2' },
      { kind: 'event', id: 'e3' },
    ];
    expect(deriveMemberKeys(members)).toEqual(['event:e1', 'story:s2', 'event:e3']);
  });

  it('derives an empty list for no members', () => {
    expect(deriveMemberKeys([])).toEqual([]);
  });
});
