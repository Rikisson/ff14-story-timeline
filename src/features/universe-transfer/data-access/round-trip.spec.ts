import { describe, expect, it } from 'vitest';
import { EntityKind, EntityRef } from '@shared/models';
import { buildCanonicalDocs } from './build-canonical-docs';
import { ConflictResolution } from './dry-run-report.types';
import { ImportContext, resolveImport } from './mint-ids';
import { ExportInput, buildUniverseArchive } from './to-archive';
import { validateSemantics } from './validate-semantics';
import { validateStructure } from './validate-structure';

function counterIdGen(prefix: string): () => string {
  let count = 0;
  return () => `${prefix}-${++count}`;
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

const RENAME_ALL: Record<EntityKind, ConflictResolution> = {
  character: 'rename',
  place: 'rename',
  event: 'rename',
  story: 'rename',
  plotline: 'rename',
  codexEntry: 'rename',
};

function sampleInput(): ExportInput {
  return {
    universe: {
      id: 'u1',
      slug: 'eorzea',
      name: 'Eorzea',
      locale: 'en',
      authorUid: 'owner',
      editorUids: [],
      deletedAt: null,
      storageBytes: 0,
      assetCount: 0,
      createdAt: 1,
    },
    assets: [],
    characters: [
      {
        id: 'c1',
        slug: 'eldrin',
        name: 'Eldrin',
        description: 'A hero.',
        authorUid: 'owner',
        createdAt: 1,
      },
    ],
    places: [
      {
        id: 'p1',
        slug: 'harbor',
        name: 'Old Harbor',
        authorUid: 'owner',
        createdAt: 1,
        relatedRefs: [{ kind: 'character', id: 'c1' }],
      },
    ],
    plotlines: [],
    events: [],
    codexEntries: [],
    stories: [
      {
        story: {
          id: 's1',
          slug: 'chapter-1',
          title: 'Chapter 1',
          inGameDate: {},
          authorUid: 'owner',
          draft: false,
          createdAt: 1,
        },
        content: {
          startSceneId: 'scene-uuid-1',
          scenes: {
            'scene-uuid-1': {
              text: 'Meet ${ch:c1}[Eldrin].',
              characters: [{ entity: { kind: 'character', id: 'c1' }, position: 'center' }],
              next: [{ sceneId: 'scene-uuid-2' }],
              position: { x: 0, y: 0 },
            },
            'scene-uuid-2': {
              text: 'At the harbor.',
              characters: [],
              place: { kind: 'place', id: 'p1' },
              next: [],
              position: { x: 360, y: 0 },
            },
          },
        },
      },
    ],
  };
}

describe('export / import round trip', () => {
  it('produces an archive that passes structural validation', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    expect(validateStructure(archive).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('produces an archive with no semantic errors', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    const errors = validateSemantics(archive, emptyContext()).filter(
      (issue) => issue.severity === 'error',
    );
    expect(errors).toEqual([]);
  });

  it('rebuilds canonical entities with refs resolved to fresh ids', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    const resolution = resolveImport(archive, emptyContext(), RENAME_ALL, counterIdGen('entity'));
    const docs = buildCanonicalDocs(archive, {
      resolution,
      authorUid: 'importer',
      now: 999,
      idGen: counterIdGen('scene'),
    });

    expect(docs).toHaveLength(3);
    const place = docs.find((doc) => doc.kind === 'place');
    const character = docs.find((doc) => doc.kind === 'character');
    const relatedRefs = place?.doc['relatedRefs'] as EntityRef[] | undefined;
    expect(relatedRefs?.[0].id).toBe(character?.id);

    const story = docs.find((doc) => doc.kind === 'story');
    expect(Object.keys(story?.content?.scenes ?? {})).toHaveLength(2);
  });

  it('re-resolves inline tokens to the freshly minted entity id', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    const resolution = resolveImport(archive, emptyContext(), RENAME_ALL, counterIdGen('entity'));
    const docs = buildCanonicalDocs(archive, {
      resolution,
      authorUid: 'importer',
      now: 999,
      idGen: counterIdGen('scene'),
    });
    const story = docs.find((doc) => doc.kind === 'story');
    const character = docs.find((doc) => doc.kind === 'character');
    const firstScene = Object.values(story?.content?.scenes ?? {})[0];
    expect(firstScene?.text).toContain(`\${ch:${character?.id}}`);
  });
});
