import { describe, expect, it } from 'vitest';
import { ValidationIssue } from './dry-run-report.types';
import { validateStructure } from './validate-structure';

function codes(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function errors(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === 'error');
}

function minimalScene(): Record<string, unknown> {
  return { text: '', characters: [], next: [] };
}

describe('validateStructure', () => {
  it('accepts a minimal valid archive', () => {
    const issues = validateStructure({
      formatVersion: 2,
      characters: [{ slug: 'eldrin', name: 'Eldrin' }],
    });
    expect(errors(issues)).toEqual([]);
  });

  it('flags a missing formatVersion', () => {
    expect(codes(validateStructure({ characters: [] }))).toContain('format-version-missing');
  });

  it('flags a character missing its name', () => {
    expect(
      codes(validateStructure({ formatVersion: 2, characters: [{ slug: 'eldrin' }] })),
    ).toContain('field-required');
  });

  it('flags an invalid slug', () => {
    expect(
      codes(validateStructure({ formatVersion: 2, characters: [{ slug: 'Eldrin!', name: 'E' }] })),
    ).toContain('slug-invalid');
  });

  it('flags duplicate slugs within a section', () => {
    const issues = validateStructure({
      formatVersion: 2,
      characters: [
        { slug: 'eldrin', name: 'A' },
        { slug: 'eldrin', name: 'B' },
      ],
    });
    expect(codes(issues)).toContain('slug-duplicate');
  });

  it('flags a story whose defaultEntryScene is not defined', () => {
    const issues = validateStructure({
      formatVersion: 2,
      stories: [
        {
          slug: 's',
          title: 'S',
          inGameDate: {},
          defaultEntryScene: 'missing',
          scenes: { intro: minimalScene() },
        },
      ],
    });
    expect(codes(issues)).toContain('default-entry-scene-unknown');
  });

  it('flags a scene linking to an unknown scene', () => {
    const issues = validateStructure({
      formatVersion: 2,
      stories: [
        {
          slug: 's',
          title: 'S',
          inGameDate: {},
          defaultEntryScene: 'intro',
          scenes: { intro: { ...minimalScene(), next: [{ scene: 'ghost' }] } },
        },
      ],
    });
    expect(codes(issues)).toContain('next-scene-unknown');
  });

  it('rejects an unknown enum value', () => {
    const issues = validateStructure({
      formatVersion: 2,
      plotlines: [{ slug: 'p', title: 'P', status: 'archived' }],
    });
    expect(codes(issues)).toContain('bad-enum');
  });

  it('notes server-managed fields as info, not error', () => {
    const issues = validateStructure({
      formatVersion: 2,
      characters: [{ slug: 'e', name: 'E', id: 'x', authorUid: 'u' }],
    });
    const info = issues.find((issue) => issue.code === 'server-fields-ignored');
    expect(info?.severity).toBe('info');
    expect(errors(issues)).toEqual([]);
  });

  it('flags a story whose scene content exceeds the document size limit', () => {
    const issues = validateStructure({
      formatVersion: 2,
      stories: [
        {
          slug: 's',
          title: 'S',
          inGameDate: {},
          defaultEntryScene: 'intro',
          scenes: { intro: { text: 'x'.repeat(1_000_000), characters: [], next: [] } },
        },
      ],
    });
    expect(codes(issues)).toContain('story-too-large');
  });
});
