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
    events: [
      {
        id: 'e1',
        slug: 'calamity',
        name: 'The Calamity',
        description: 'Everything changed.',
        inGameDate: {},
        authorUid: 'owner',
        createdAt: 1,
      },
    ],
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
          defaultEntrySceneId: 'scene-uuid-1',
          scenes: {
            'scene-uuid-1': {
              text: 'Meet ${ch:c1}[Eldrin].',
              characters: [{ entity: { kind: 'character', id: 'c1' }, position: 'center' }],
              next: [{ sceneId: 'scene-uuid-2' }],
              position: { x: 0, y: 0 },
            },
            'scene-uuid-2': {
              text: 'At the harbor.',
              label: 'harbor-ending',
              characters: [],
              place: { kind: 'place', id: 'p1' },
              next: [],
              position: { x: 360, y: 0 },
            },
          },
        },
      },
      {
        story: {
          id: 's2',
          slug: 'chapter-2',
          title: 'Chapter 2',
          inGameDate: {},
          authorUid: 'owner',
          draft: false,
          createdAt: 1,
        },
        content: {
          defaultEntrySceneId: 'scene-uuid-3',
          scenes: {
            'scene-uuid-3': {
              text: 'A new dawn.',
              characters: [],
              next: [{ sceneId: 'scene-uuid-4' }],
              position: { x: 0, y: 0 },
            },
            'scene-uuid-4': {
              text: 'The finale.',
              label: 'finale',
              characters: [],
              next: [],
              position: { x: 360, y: 0 },
              isEntry: true,
            },
          },
        },
      },
    ],
    connections: [
      {
        id: 'story_s1_scene-uuid-2',
        type: 'continues',
        from: { kind: 'story', storyId: 's1', sceneId: 'scene-uuid-2' },
        to: { kind: 'event', eventId: 'e1' },
        fromEntityKey: 'story:s1',
        toEntityKey: 'event:e1',
        visibility: 'reader',
        snapshotTitle: 'The Calamity',
        createdBy: 'owner',
        updatedBy: 'owner',
        updatedAt: 1,
      },
      {
        id: 'event_e1',
        type: 'continues',
        from: { kind: 'event', eventId: 'e1' },
        to: { kind: 'story', storyId: 's2', sceneId: 'scene-uuid-4' },
        fromEntityKey: 'event:e1',
        toEntityKey: 'story:s2',
        visibility: 'reader',
        note: 'Picks up at the finale entry.',
        createdBy: 'owner',
        updatedBy: 'owner',
        updatedAt: 1,
      },
      {
        id: 'story_s2_scene-uuid-4',
        type: 'continues',
        from: { kind: 'story', storyId: 's2', sceneId: 'scene-uuid-4' },
        to: null,
        fromEntityKey: 'story:s2',
        toEntityKey: null,
        visibility: 'editor',
        note: 'Hand-off: next chapter pending.',
        createdBy: 'owner',
        updatedBy: 'owner',
        updatedAt: 1,
      },
      {
        id: 'story_s1_scene-uuid-9',
        type: 'continues',
        from: { kind: 'story', storyId: 'ghost-story', sceneId: 'scene-uuid-9' },
        to: { kind: 'event', eventId: 'e1' },
        fromEntityKey: 'story:ghost-story',
        toEntityKey: 'event:e1',
        visibility: 'reader',
        createdBy: 'owner',
        updatedBy: 'owner',
        updatedAt: 1,
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

  it('exports connections with slug-keyed endpoints and drops unresolvable ones', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    expect(archive.connections).toHaveLength(3);
    const [wired, entryOverride, pending] = archive.connections ?? [];
    expect(wired.from).toEqual({ kind: 'story', story: 'chapter-1', scene: 'harbor-ending' });
    expect(wired.to).toEqual({ kind: 'event', event: 'calamity' });
    expect(entryOverride.to).toEqual({ kind: 'story', story: 'chapter-2', scene: 'finale' });
    expect(pending.to).toBeNull();
    expect(pending.visibility).toBe('editor');
  });

  it('rebuilds canonical entities with refs resolved to fresh ids', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    const resolution = resolveImport(archive, emptyContext(), RENAME_ALL, counterIdGen('entity'));
    const { docs } = buildCanonicalDocs(archive, {
      resolution,
      authorUid: 'importer',
      now: 999,
      idGen: counterIdGen('scene'),
    });

    expect(docs).toHaveLength(5);
    const place = docs.find((doc) => doc.kind === 'place');
    const character = docs.find((doc) => doc.kind === 'character');
    const relatedRefs = place?.doc['relatedRefs'] as EntityRef[] | undefined;
    expect(relatedRefs?.[0].id).toBe(character?.id);

    const story = docs.find((doc) => doc.kind === 'story');
    expect(Object.keys(story?.content?.scenes ?? {})).toHaveLength(2);
  });

  it('rebuilds connections against minted ids with deterministic doc ids', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    const resolution = resolveImport(archive, emptyContext(), RENAME_ALL, counterIdGen('entity'));
    const { docs, connections } = buildCanonicalDocs(archive, {
      resolution,
      authorUid: 'importer',
      now: 999,
      idGen: counterIdGen('scene'),
    });

    expect(connections).toHaveLength(3);
    const event = docs.find((doc) => doc.kind === 'event');
    const stories = docs.filter((doc) => doc.kind === 'story');
    const chapterOne = stories.find((doc) => doc.archiveSlug === 'chapter-1');
    const chapterTwo = stories.find((doc) => doc.archiveSlug === 'chapter-2');

    const wired = connections.find((c) => c.doc.from.kind === 'story' && c.id.startsWith(`story_${chapterOne?.id}`));
    expect(wired).toBeDefined();
    expect(wired?.doc.to).toEqual({ kind: 'event', eventId: event?.id });
    expect(wired?.doc.fromEntityKey).toBe(`story:${chapterOne?.id}`);
    expect(wired?.doc.toEntityKey).toBe(`event:${event?.id}`);
    expect(wired?.doc.createdBy).toBe('importer');

    const fromEvent = connections.find((c) => c.id === `event_${event?.id}`);
    expect(fromEvent).toBeDefined();
    const target = fromEvent?.doc.to;
    expect(target?.kind).toBe('story');
    if (target?.kind === 'story') {
      expect(target.storyId).toBe(chapterTwo?.id);
      expect(target.sceneId).toBeDefined();
      expect(Object.keys(chapterTwo?.content?.scenes ?? {})).toContain(target.sceneId);
    }

    const pending = connections.find((c) => c.doc.to === null);
    expect(pending).toBeDefined();
    expect(pending?.doc.toEntityKey).toBeNull();
    expect(pending?.doc.visibility).toBe('editor');
  });

  it('rejects a connection targeting a non-entry scene', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    const broken = structuredClone(archive);
    const conn = broken.connections?.find(
      (c) => c.to !== null && c.to.kind === 'story' && c.to.scene !== undefined,
    );
    // chapter-1's "harbor-ending" is terminal but neither isEntry nor
    // the defaultEntryScene — an invalid continuation target.
    if (conn?.to?.kind === 'story') {
      conn.to.story = 'chapter-1';
      conn.to.scene = 'harbor-ending';
    }
    const errors = validateSemantics(broken, emptyContext()).filter(
      (issue) => issue.severity === 'error',
    );
    expect(errors.some((issue) => issue.code === 'connection-target-not-entry')).toBe(true);
  });

  it('re-resolves inline tokens to the freshly minted entity id', () => {
    const { archive } = buildUniverseArchive(sampleInput());
    const resolution = resolveImport(archive, emptyContext(), RENAME_ALL, counterIdGen('entity'));
    const { docs } = buildCanonicalDocs(archive, {
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
