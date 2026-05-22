import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore/lite';
import { beforeEach, describe, expect, it } from 'vitest';
import { SlugTakenError } from '@shared/models';
import {
  applyEntityDelete,
  applyEntityWrite,
  UNASSIGNED_LANE_KEY,
} from './with-entity-projections';
import type { DirectoryRowInputs, TimelineRowInputs } from './projection-rows';

interface RecordedOp {
  op: 'set' | 'delete';
  path: string;
  data?: Record<string, unknown>;
}

let database: Map<string, Record<string, unknown>>;
let recordedOps: RecordedOp[];

// A real Firestore handle. `doc()` builds document references offline (no
// I/O); reads and writes are served by `fakeTx`. The primitives
// `applyEntityWrite` / `applyEntityDelete` take the transaction as a
// parameter, so the test never touches the real transaction machinery and
// never has to mock the `firebase/firestore/lite` module.
const firestore = getFirestore(
  initializeApp({ projectId: 'unit-test' }, 'with-entity-projections-spec'),
);

const fakeTx = {
  get: async (ref: { path: string }) => {
    const payload = database.get(ref.path);
    return {
      exists: () => payload !== undefined,
      data: () => payload,
      id: ref.path.split('/').pop() ?? '',
    };
  },
  set: (ref: { path: string }, data: Record<string, unknown>) => {
    recordedOps.push({ op: 'set', path: ref.path, data });
    database.set(ref.path, data);
  },
  delete: (ref: { path: string }) => {
    recordedOps.push({ op: 'delete', path: ref.path });
    database.delete(ref.path);
  },
};

function setDocs(entries: Record<string, Record<string, unknown>>): void {
  for (const [path, data] of Object.entries(entries)) database.set(path, data);
}

function opsByPath(): Record<string, RecordedOp> {
  const out: Record<string, RecordedOp> = {};
  for (const op of recordedOps) out[op.path] = op;
  return out;
}

/** Build a buildInputs callback that returns the same fixed values regardless of merged state. */
function fixedInputs(
  directory: DirectoryRowInputs,
  timeline?: TimelineRowInputs,
): () => { directory: DirectoryRowInputs; timeline?: TimelineRowInputs } {
  return () => (timeline ? { directory, timeline } : { directory });
}

const U = 'universes/u1';
const dirPath = (kind: string, id: string) => `${U}/_directory/${kind}_${id}`;
const timelinePath = (kind: string, id: string) => `${U}/_timelineEntries/${kind}_${id}`;
const lanePath = (lane: string, kind: string, id: string) =>
  `${U}/_timelineLaneEntries/${lane}_${kind}_${id}`;
const slugPath = (kind: string, slug: string) => `${U}/_slugIndex/${kind}_${slug}`;

beforeEach(() => {
  database = new Map();
  recordedOps = [];
});

describe('applyEntityWrite —create', () => {
  it('writes canonical, directory, slug-index for a flat entity', async () => {
    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'character',
      id: 'c1',
      canonicalCollection: 'characters',
      patch: { slug: 'aria', name: 'Aria' },
      slug: 'aria',
      buildInputs: fixedInputs({ label: 'Aria', secondary: 'Marcus' }),
    });

    const ops = opsByPath();
    expect(ops[`${U}/characters/c1`]).toBeDefined();
    expect(ops[`${U}/characters/c1`].op).toBe('set');
    expect(ops[`${U}/characters/c1`].data).toEqual({ slug: 'aria', name: 'Aria' });

    expect(ops[dirPath('character', 'c1')]).toBeDefined();
    expect(ops[dirPath('character', 'c1')].data).toMatchObject({
      kind: 'character',
      entityId: 'c1',
      label: 'Aria',
      labelFolded: 'aria',
      slug: 'aria',
      secondary: 'Marcus',
      visiblePublic: true,
    });
    expect(ops[dirPath('character', 'c1')].data).toHaveProperty('sourceFingerprint');
    expect(ops[dirPath('character', 'c1')].data).toHaveProperty('updatedAt');

    expect(ops[slugPath('character', 'aria')]).toBeDefined();
    expect(ops[slugPath('character', 'aria')].data).toEqual({ entityId: 'c1' });

    expect(ops[timelinePath('character', 'c1')]).toBeUndefined();
  });

  it('writes timeline + lane rows for a story', async () => {
    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'story',
      id: 's1',
      canonicalCollection: 'stories',
      patch: { slug: 'opening', title: 'Opening', draft: false },
      slug: 'opening',
      buildInputs: fixedInputs(
        { label: 'Opening', secondary: '15 Spring of 1577', draft: false },
        {
          title: 'Opening',
          inGameDate: { era: 'e1', year: 1577, month: 3, day: 15 },
          dateSortKey: '00010001577031500000000000000',
          dateKnown: true,
          plotlineIds: ['pl-arr', 'pl-hw'],
          characterIds: ['c1'],
          placeIds: ['p1'],
        },
      ),
    });

    const ops = opsByPath();
    expect(ops[timelinePath('story', 's1')]).toBeDefined();
    expect(ops[timelinePath('story', 's1')].data).toMatchObject({
      title: 'Opening',
      plotlineIds: ['pl-arr', 'pl-hw'],
      visiblePublic: true,
      draft: false,
    });
    expect(ops[lanePath('pl-arr', 'story', 's1')].data).toMatchObject({
      laneKey: 'pl-arr',
      plotlineIds: ['pl-arr', 'pl-hw'],
    });
    expect(ops[lanePath('pl-hw', 'story', 's1')].data).toMatchObject({
      laneKey: 'pl-hw',
      plotlineIds: ['pl-arr', 'pl-hw'],
    });
  });

  it('writes an __unassigned__ lane row when plotlineIds is empty', async () => {
    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'event',
      id: 'e1',
      canonicalCollection: 'events',
      patch: { slug: 'fall', name: 'Fall' },
      slug: 'fall',
      buildInputs: fixedInputs(
        { label: 'Fall' },
        {
          title: 'Fall',
          inGameDate: { era: 'e1', year: 1572 },
          dateSortKey: 'k',
          dateKnown: true,
          plotlineIds: [],
          characterIds: [],
          placeIds: [],
        },
      ),
    });

    expect(opsByPath()[lanePath(UNASSIGNED_LANE_KEY, 'event', 'e1')]).toBeDefined();
  });

  it('marks drafts with visiblePublic=false on directory and timeline rows', async () => {
    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'story',
      id: 's-draft',
      canonicalCollection: 'stories',
      patch: { slug: 'wip', title: 'WIP', draft: true },
      slug: 'wip',
      buildInputs: fixedInputs(
        { label: 'WIP', draft: true },
        {
          title: 'WIP',
          inGameDate: {},
          dateSortKey: '0',
          dateKnown: false,
          plotlineIds: [],
          characterIds: [],
          placeIds: [],
        },
      ),
    });

    const ops = opsByPath();
    expect(ops[dirPath('story', 's-draft')].data).toMatchObject({ visiblePublic: false, draft: true });
    expect(ops[timelinePath('story', 's-draft')].data).toMatchObject({ visiblePublic: false, draft: true });
    expect(ops[lanePath(UNASSIGNED_LANE_KEY, 'story', 's-draft')].data).toMatchObject({
      visiblePublic: false,
      draft: true,
    });
  });
});

describe('applyEntityWrite —patch merge', () => {
  it('preserves existing fields not in the patch (the fix for the stale-write race)', async () => {
    setDocs({
      [`${U}/characters/me`]: {
        slug: 'me',
        name: 'Me',
        authorUid: 'user-A',
        createdAt: 1000,
        sprites: ['sprite-1', 'sprite-2'],
      },
    });

    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'character',
      id: 'me',
      canonicalCollection: 'characters',
      patch: { slug: 'me', name: 'Me Renamed', updatedAt: 2000 },
      slug: 'me',
      buildInputs: fixedInputs({ label: 'Me Renamed' }),
    });

    const ops = opsByPath();
    // Canonical merge keeps authorUid, createdAt, sprites that weren't in the patch.
    expect(ops[`${U}/characters/me`].data).toMatchObject({
      slug: 'me',
      name: 'Me Renamed',
      authorUid: 'user-A',
      createdAt: 1000,
      sprites: ['sprite-1', 'sprite-2'],
      updatedAt: 2000,
    });
  });
});

describe('applyEntityWrite —slug uniqueness', () => {
  it('throws SlugTakenError when the new slug belongs to another entity', async () => {
    setDocs({ [slugPath('character', 'taken')]: { entityId: 'other' } });

    await expect(
      applyEntityWrite(fakeTx as never, firestore, {
        universeId: 'u1',
        kind: 'character',
        id: 'me',
        canonicalCollection: 'characters',
        patch: { slug: 'taken' },
        slug: 'taken',
        buildInputs: fixedInputs({ label: 'Me' }),
      }),
    ).rejects.toThrow(SlugTakenError);
  });

  it('claims a slug already owned by the same entity without throwing or re-writing it', async () => {
    setDocs({
      [`${U}/characters/me`]: { slug: 'mine' },
      [slugPath('character', 'mine')]: { entityId: 'me' },
    });

    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'character',
      id: 'me',
      canonicalCollection: 'characters',
      patch: { slug: 'mine' },
      slug: 'mine',
      buildInputs: fixedInputs({ label: 'Me' }),
    });

    const slugOp = recordedOps.find((o) => o.path === slugPath('character', 'mine'));
    expect(slugOp).toBeUndefined();
  });

  it('renames: deletes the old slug-index doc and claims the new one', async () => {
    setDocs({
      [`${U}/characters/me`]: { slug: 'old-name' },
      [slugPath('character', 'old-name')]: { entityId: 'me' },
    });

    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'character',
      id: 'me',
      canonicalCollection: 'characters',
      patch: { slug: 'new-name' },
      slug: 'new-name',
      buildInputs: fixedInputs({ label: 'Me' }),
    });

    const ops = opsByPath();
    expect(ops[slugPath('character', 'old-name')].op).toBe('delete');
    expect(ops[slugPath('character', 'new-name')].op).toBe('set');
    expect(ops[slugPath('character', 'new-name')].data).toEqual({ entityId: 'me' });
  });
});

describe('applyEntityWrite —fingerprint diff', () => {
  it('skips projection writes when the projected slice is unchanged', async () => {
    const FIRST_RUN = async () => {
      await applyEntityWrite(fakeTx as never, firestore, {
        universeId: 'u1',
        kind: 'place',
        id: 'p1',
        canonicalCollection: 'places',
        patch: { slug: 'ish', name: 'Ish' },
        slug: 'ish',
        buildInputs: fixedInputs({ label: 'Ishgard', secondary: 'A place' }),
      });
    };

    await FIRST_RUN();

    // Reset op log; database keeps state.
    recordedOps = [];

    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'place',
      id: 'p1',
      canonicalCollection: 'places',
      patch: { slug: 'ish', name: 'Ish v2' }, // canonical changes but projected slice does not
      slug: 'ish',
      buildInputs: fixedInputs({ label: 'Ishgard', secondary: 'A place' }),
    });

    const ops = opsByPath();
    // Canonical was written.
    expect(ops[`${U}/places/p1`]).toBeDefined();
    expect(ops[`${U}/places/p1`].data).toMatchObject({ name: 'Ish v2' });
    // Directory projection write was skipped.
    expect(ops[dirPath('place', 'p1')]).toBeUndefined();
  });

  it('rewrites projections when label changes', async () => {
    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'place',
      id: 'p1',
      canonicalCollection: 'places',
      patch: { slug: 'ish', name: 'Ish' },
      slug: 'ish',
      buildInputs: fixedInputs({ label: 'Ishgard' }),
    });

    recordedOps = [];

    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'place',
      id: 'p1',
      canonicalCollection: 'places',
      patch: { slug: 'ish', name: 'Ish' },
      slug: 'ish',
      buildInputs: fixedInputs({ label: 'Ishgard Restored' }),
    });

    expect(opsByPath()[dirPath('place', 'p1')]).toBeDefined();
    expect(opsByPath()[dirPath('place', 'p1')].data).toMatchObject({ label: 'Ishgard Restored' });
  });
});

describe('applyEntityWrite —lane diff', () => {
  it('deletes lanes the entity left and writes new lanes when plotlineIds change', async () => {
    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'story',
      id: 's1',
      canonicalCollection: 'stories',
      patch: { slug: 'opening', title: 'Opening', draft: false },
      slug: 'opening',
      buildInputs: fixedInputs(
        { label: 'Opening', draft: false },
        {
          title: 'Opening',
          inGameDate: { era: 'e1', year: 1577 },
          dateSortKey: 'k1',
          dateKnown: true,
          plotlineIds: ['pl-a', 'pl-b'],
          characterIds: [],
          placeIds: [],
        },
      ),
    });

    recordedOps = [];

    await applyEntityWrite(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'story',
      id: 's1',
      canonicalCollection: 'stories',
      patch: { slug: 'opening', title: 'Opening v2', draft: false },
      slug: 'opening',
      buildInputs: fixedInputs(
        { label: 'Opening v2', draft: false }, // label change → fingerprint differs
        {
          title: 'Opening v2',
          inGameDate: { era: 'e1', year: 1577 },
          dateSortKey: 'k1',
          dateKnown: true,
          plotlineIds: ['pl-b', 'pl-c'], // pl-a removed, pl-c added
          characterIds: [],
          placeIds: [],
        },
      ),
    });

    const ops = opsByPath();
    expect(ops[lanePath('pl-a', 'story', 's1')].op).toBe('delete');
    expect(ops[lanePath('pl-b', 'story', 's1')].op).toBe('set');
    expect(ops[lanePath('pl-c', 'story', 's1')].op).toBe('set');
  });
});

describe('applyEntityDelete', () => {
  it('deletes canonical, directory, timeline, slug-index, and every lane row', async () => {
    setDocs({
      [`${U}/stories/s1`]: { slug: 'opening', title: 'Opening' },
      [dirPath('story', 's1')]: { kind: 'story', entityId: 's1' },
      [timelinePath('story', 's1')]: { kind: 'story', plotlineIds: ['pl-a', 'pl-b'] },
      [slugPath('story', 'opening')]: { entityId: 's1' },
      [lanePath('pl-a', 'story', 's1')]: { laneKey: 'pl-a' },
      [lanePath('pl-b', 'story', 's1')]: { laneKey: 'pl-b' },
    });

    await applyEntityDelete(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'story',
      id: 's1',
      canonicalCollection: 'stories',
    });

    const ops = opsByPath();
    expect(ops[`${U}/stories/s1`].op).toBe('delete');
    expect(ops[dirPath('story', 's1')].op).toBe('delete');
    expect(ops[timelinePath('story', 's1')].op).toBe('delete');
    expect(ops[slugPath('story', 'opening')].op).toBe('delete');
    expect(ops[lanePath('pl-a', 'story', 's1')].op).toBe('delete');
    expect(ops[lanePath('pl-b', 'story', 's1')].op).toBe('delete');
  });

  it('handles delete of an entity with no timeline row (non-timeline kind)', async () => {
    setDocs({
      [`${U}/characters/c1`]: { slug: 'aria' },
      [dirPath('character', 'c1')]: { kind: 'character', entityId: 'c1' },
      [slugPath('character', 'aria')]: { entityId: 'c1' },
    });

    await applyEntityDelete(fakeTx as never, firestore, {
      universeId: 'u1',
      kind: 'character',
      id: 'c1',
      canonicalCollection: 'characters',
    });

    const ops = opsByPath();
    expect(ops[`${U}/characters/c1`].op).toBe('delete');
    expect(ops[dirPath('character', 'c1')].op).toBe('delete');
    expect(ops[slugPath('character', 'aria')].op).toBe('delete');
    expect(ops[timelinePath('character', 'c1')]).toBeUndefined();
  });
});
