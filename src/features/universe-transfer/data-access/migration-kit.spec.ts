import { describe, expect, it } from 'vitest';
import exampleUniverse from '../../../../public/migration-kit/example-universe.json';
import { UniverseArchive } from './archive-format';
import { ImportContext } from './mint-ids';
import { validateSemantics } from './validate-semantics';
import { validateStructure } from './validate-structure';

function emptyContext(): ImportContext {
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
  };
}

describe('migration kit example-universe.json', () => {
  it('passes structural validation with no errors', () => {
    const issues = validateStructure(exampleUniverse);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('passes semantic validation with no errors or warnings', () => {
    const issues = validateSemantics(exampleUniverse as unknown as UniverseArchive, emptyContext());
    expect(issues).toEqual([]);
  });
});
