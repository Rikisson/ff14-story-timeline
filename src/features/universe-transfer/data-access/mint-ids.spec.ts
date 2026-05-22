import { describe, expect, it } from 'vitest';
import { EntityKind } from '@shared/models';
import { UniverseArchive } from './archive-format';
import { ConflictResolution } from './dry-run-report.types';
import { ImportContext, resolveImport } from './mint-ids';

function counterIdGen(): () => string {
  let count = 0;
  return () => `id-${++count}`;
}

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

function policy(resolution: ConflictResolution): Record<EntityKind, ConflictResolution> {
  return {
    character: resolution,
    place: resolution,
    event: resolution,
    story: resolution,
    plotline: resolution,
    codexEntry: resolution,
  };
}

describe('resolveImport', () => {
  it('creates entities with minted ids when there is no collision', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [{ slug: 'eldrin', name: 'Eldrin' }],
    };
    const resolution = resolveImport(archive, emptyContext(), policy('rename'), counterIdGen());
    expect(resolution.entities).toHaveLength(1);
    expect(resolution.entities[0]).toMatchObject({
      archiveSlug: 'eldrin',
      finalSlug: 'eldrin',
      action: 'create',
    });
    expect(resolution.idBySlug.character.get('eldrin')).toBe(resolution.entities[0].id);
  });

  it('skips a colliding entity and points refs at the existing one', () => {
    const ctx = emptyContext();
    ctx.existingEntityIds.character.set('eldrin', 'existing-id');
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [{ slug: 'eldrin', name: 'Eldrin' }],
    };
    const resolution = resolveImport(archive, ctx, policy('skip'), counterIdGen());
    expect(resolution.entities[0].action).toBe('skip');
    expect(resolution.entities[0].id).toBe('existing-id');
    expect(resolution.idBySlug.character.get('eldrin')).toBe('existing-id');
  });

  it('renames a colliding entity to <slug>-imported with a fresh id', () => {
    const ctx = emptyContext();
    ctx.existingEntityIds.character.set('eldrin', 'existing-id');
    const archive: UniverseArchive = {
      formatVersion: 1,
      characters: [{ slug: 'eldrin', name: 'Eldrin' }],
    };
    const resolution = resolveImport(archive, ctx, policy('rename'), counterIdGen());
    expect(resolution.entities[0].action).toBe('rename');
    expect(resolution.entities[0].finalSlug).toBe('eldrin-imported');
    expect(resolution.entities[0].id).not.toBe('existing-id');
    expect(resolution.idBySlug.character.get('eldrin')).toBe(resolution.entities[0].id);
  });

  it('mints asset ids and applies the calendar when the target has none', () => {
    const archive: UniverseArchive = {
      formatVersion: 1,
      assets: [{ slug: 'cover', kind: 'cover', label: 'Cover' }],
      calendar: { eras: [{ slug: 'first-era', name: 'First Era' }], months: [] },
    };
    const resolution = resolveImport(archive, emptyContext(), policy('rename'), counterIdGen());
    expect(resolution.assetIdBySlug.get('cover')).toBeDefined();
    expect(resolution.applyCalendar).toBe(true);
    expect(resolution.eraIdBySlug.get('first-era')).toBeDefined();
  });

  it('keeps the existing calendar when the target already has one', () => {
    const ctx = emptyContext();
    ctx.targetHasCalendar = true;
    ctx.existingEraIdBySlug.set('first-era', 'era-id');
    const archive: UniverseArchive = {
      formatVersion: 1,
      calendar: { eras: [{ slug: 'first-era', name: 'First Era' }], months: [] },
    };
    const resolution = resolveImport(archive, ctx, policy('rename'), counterIdGen());
    expect(resolution.applyCalendar).toBe(false);
    expect(resolution.eraIdBySlug.get('first-era')).toBe('era-id');
  });
});
