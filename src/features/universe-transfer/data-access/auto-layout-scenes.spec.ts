import { describe, expect, it } from 'vitest';
import { ArchiveScene } from './archive-format';
import { autoLayoutScenes } from './auto-layout-scenes';

function scene(next: string[]): ArchiveScene {
  return { text: '', characters: [], next: next.map((target) => ({ scene: target })) };
}

describe('autoLayoutScenes', () => {
  it('lays a linear chain out in columns', () => {
    const positions = autoLayoutScenes({ a: scene(['b']), b: scene(['c']), c: scene([]) }, 'a');
    expect(positions.get('a')).toEqual({ x: 0, y: 0 });
    expect(positions.get('b')).toEqual({ x: 360, y: 0 });
    expect(positions.get('c')).toEqual({ x: 720, y: 0 });
  });

  it('stacks branch targets in separate rows of the same column', () => {
    const positions = autoLayoutScenes({ a: scene(['b', 'c']), b: scene([]), c: scene([]) }, 'a');
    expect(positions.get('b')?.x).toBe(360);
    expect(positions.get('c')?.x).toBe(360);
    expect(positions.get('b')?.y).not.toBe(positions.get('c')?.y);
  });

  it('still positions scenes unreachable from the start', () => {
    const positions = autoLayoutScenes({ a: scene([]), orphan: scene([]) }, 'a');
    expect(positions.has('orphan')).toBe(true);
    expect(positions.get('orphan')).not.toEqual(positions.get('a'));
  });

  it('gives every scene a unique position', () => {
    const positions = autoLayoutScenes(
      { a: scene(['b', 'c']), b: scene(['d']), c: scene(['d']), d: scene([]) },
      'a',
    );
    const seen = new Set([...positions.values()].map((point) => `${point.x},${point.y}`));
    expect(seen.size).toBe(positions.size);
  });
});
