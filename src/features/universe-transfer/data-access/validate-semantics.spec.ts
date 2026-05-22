import { describe, expect, it } from 'vitest';
import { UniverseArchive } from './archive-format';
import { ImportContext } from './mint-ids';
import { countCollisions, validateSemantics } from './validate-semantics';

function context(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    existingEntityIds: {
      character: new Map(),
      place: new Map(),
      event: new Map(),
      story: new Map(),
      plotline: new Map(),
      codexEntry: new Map(),
    },
    existingEraIdBySlug: new Map(),
    existingCategoryKeys: new Set(),
    targetHasCalendar: false,
    ...overrides,
  };
}

describe('validateSemantics', () => {
  it('passes when refs resolve within the package', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [{ slug: 'eldrin', name: 'Eldrin' }],
      places: [
        { slug: 'harbor', name: 'Harbor', relatedRefs: [{ kind: 'character', ref: 'eldrin' }] },
      ],
    };
    expect(validateSemantics(archive, context())).toEqual([]);
  });

  it('flags an orphan structured ref as an error', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      stories: [
        {
          slug: 's',
          title: 'S',
          inGameDate: {},
          startScene: 'intro',
          scenes: {
            intro: {
              text: '',
              characters: [],
              next: [],
              speaker: { kind: 'character', ref: 'ghost' },
            },
          },
        },
      ],
    };
    const issues = validateSemantics(archive, context());
    expect(
      issues.some((issue) => issue.code === 'ref-unresolved' && issue.severity === 'error'),
    ).toBe(true);
  });

  it('treats an orphan relatedRef as a warning', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [
        { slug: 'eldrin', name: 'Eldrin', relatedRefs: [{ kind: 'place', ref: 'nowhere' }] },
      ],
    };
    const issues = validateSemantics(archive, context());
    expect(issues.find((issue) => issue.code === 'ref-unresolved')?.severity).toBe('warning');
  });

  it('resolves a ref against the target universe', () => {
    const ctx = context();
    ctx.existingEntityIds.character.set('eldrin', 'existing-id');
    const archive: UniverseArchive = {
      formatVersion: 1,
      places: [
        { slug: 'harbor', name: 'Harbor', relatedRefs: [{ kind: 'character', ref: 'eldrin' }] },
      ],
    };
    expect(validateSemantics(archive, ctx)).toEqual([]);
  });

  it('warns about an unresolved inline token', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [{ slug: 'eldrin', name: 'Eldrin', description: 'Knows ${ch:ghost}[Ghost].' }],
    };
    const issues = validateSemantics(archive, context());
    expect(issues.some((issue) => issue.code === 'inline-ref-unresolved')).toBe(true);
  });

  it('flags an unresolved era as a config prerequisite error', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      events: [{ slug: 'e', name: 'E', description: 'x', inGameDate: { era: 'nope' } }],
    };
    const issues = validateSemantics(archive, context({ targetHasCalendar: true }));
    expect(
      issues.some((issue) => issue.code === 'era-unresolved' && issue.severity === 'error'),
    ).toBe(true);
  });

  it('flags an unresolved codex category', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      codexEntries: [{ slug: 'c', title: 'C', description: 'x', category: 'missing' }],
    };
    expect(
      validateSemantics(archive, context()).some((issue) => issue.code === 'category-unresolved'),
    ).toBe(true);
  });

  it('suggests a near-miss slug as a hint', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [{ slug: 'eldrin', name: 'Eldrin' }],
      places: [{ slug: 'h', name: 'H', relatedRefs: [{ kind: 'character', ref: 'eldrim' }] }],
    };
    const issue = validateSemantics(archive, context()).find(
      (item) => item.code === 'ref-unresolved',
    );
    expect(issue?.hint).toContain('eldrin');
  });

  it('counts slug collisions per kind', () => {
    const ctx = context();
    ctx.existingEntityIds.character.set('eldrin', 'x');
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [
        { slug: 'eldrin', name: 'E' },
        { slug: 'new', name: 'N' },
      ],
    };
    expect(countCollisions(archive, ctx).character).toBe(1);
  });
});
