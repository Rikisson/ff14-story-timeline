import { beforeEach, describe, expect, it, vi } from 'vitest';

interface DocRef {
  path: string;
}

interface RecordedOp {
  op: 'set' | 'delete';
  path: string;
  data?: Record<string, unknown>;
}

let database: Map<string, Record<string, unknown>>;
let recordedOps: RecordedOp[];
let getCallsBeforeFirstWrite: number;

vi.mock('firebase/firestore/lite', () => {
  return {
    doc: (_firestore: unknown, ...parts: string[]) => ({ path: parts.join('/') }) as DocRef,
    runTransaction: async (_firestore: unknown, fn: (tx: unknown) => Promise<void>) => {
      let writeStarted = false;
      let pendingReads = 0;
      const tx = {
        get: async (ref: DocRef) => {
          pendingReads++;
          if (!writeStarted) getCallsBeforeFirstWrite = Math.max(getCallsBeforeFirstWrite, pendingReads);
          const payload = database.get(ref.path);
          return {
            exists: () => payload !== undefined,
            data: () => payload,
            id: ref.path.split('/').pop() ?? '',
          };
        },
        set: (ref: DocRef, data: Record<string, unknown>) => {
          writeStarted = true;
          recordedOps.push({ op: 'set', path: ref.path, data });
          database.set(ref.path, data);
        },
        delete: (ref: DocRef) => {
          writeStarted = true;
          recordedOps.push({ op: 'delete', path: ref.path });
          database.delete(ref.path);
        },
      };
      await fn(tx);
    },
  };
});

import { SlugTakenError } from '@shared/models';
import {
  deleteEntityWithProjections,
  UNASSIGNED_LANE_KEY,
  writeEntityWithProjections,
} from './with-entity-projections';

const FAKE_FIRESTORE = {} as unknown;

function setDocs(entries: Record<string, Record<string, unknown>>): void {
  for (const [path, data] of Object.entries(entries)) database.set(path, data);
}

function opsByPath(): Record<string, RecordedOp> {
  const out: Record<string, RecordedOp> = {};
  for (const op of recordedOps) out[op.path] = op;
  return out;
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
  getCallsBeforeFirstWrite = 0;
});

describe('writeEntityWithProjections — create', () => {
  it('writes canonical, directory, slug-index for a flat entity', async () => {
    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'character',
      id: 'c1',
      canonicalCollection: 'characters',
      canonical: { slug: 'aria', name: 'Aria' },
      slug: 'aria',
      directory: { label: 'Aria', secondary: 'Marcus' },
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
    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'story',
      id: 's1',
      canonicalCollection: 'stories',
      canonical: { slug: 'opening', title: 'Opening', draft: false },
      slug: 'opening',
      directory: {
        label: 'Opening',
        secondary: '15 Spring of 1577',
        draft: false,
      },
      timeline: {
        title: 'Opening',
        inGameDate: { era: 'e1', year: 1577, month: 3, day: 15 },
        dateSortKey: '00010001577031500000000000000',
        dateKnown: true,
        plotlineIds: ['pl-arr', 'pl-hw'],
        characterIds: ['c1'],
        placeIds: ['p1'],
      },
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
    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'event',
      id: 'e1',
      canonicalCollection: 'events',
      canonical: { slug: 'fall', name: 'Fall' },
      slug: 'fall',
      directory: { label: 'Fall' },
      timeline: {
        title: 'Fall',
        inGameDate: { era: 'e1', year: 1572 },
        dateSortKey: 'k',
        dateKnown: true,
        plotlineIds: [],
        characterIds: [],
        placeIds: [],
      },
    });

    expect(opsByPath()[lanePath(UNASSIGNED_LANE_KEY, 'event', 'e1')]).toBeDefined();
  });

  it('marks drafts with visiblePublic=false on directory and timeline rows', async () => {
    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'story',
      id: 's-draft',
      canonicalCollection: 'stories',
      canonical: { slug: 'wip', title: 'WIP', draft: true },
      slug: 'wip',
      directory: { label: 'WIP', draft: true },
      timeline: {
        title: 'WIP',
        inGameDate: {},
        dateSortKey: '0',
        dateKnown: false,
        plotlineIds: [],
        characterIds: [],
        placeIds: [],
      },
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

describe('writeEntityWithProjections — slug uniqueness', () => {
  it('throws SlugTakenError when the new slug belongs to another entity', async () => {
    setDocs({ [slugPath('character', 'taken')]: { entityId: 'other' } });

    await expect(
      writeEntityWithProjections(FAKE_FIRESTORE as never, {
        universeId: 'u1',
        kind: 'character',
        id: 'me',
        canonicalCollection: 'characters',
        canonical: { slug: 'taken' },
        slug: 'taken',
        directory: { label: 'Me' },
      }),
    ).rejects.toThrow(SlugTakenError);
  });

  it('claims a slug already owned by the same entity without throwing or re-writing it', async () => {
    setDocs({
      [`${U}/characters/me`]: { slug: 'mine' },
      [slugPath('character', 'mine')]: { entityId: 'me' },
    });

    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'character',
      id: 'me',
      canonicalCollection: 'characters',
      canonical: { slug: 'mine' },
      slug: 'mine',
      directory: { label: 'Me' },
    });

    const slugOp = recordedOps.find((o) => o.path === slugPath('character', 'mine'));
    expect(slugOp).toBeUndefined();
  });

  it('renames: deletes the old slug-index doc and claims the new one', async () => {
    setDocs({
      [`${U}/characters/me`]: { slug: 'old-name' },
      [slugPath('character', 'old-name')]: { entityId: 'me' },
    });

    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'character',
      id: 'me',
      canonicalCollection: 'characters',
      canonical: { slug: 'new-name' },
      slug: 'new-name',
      directory: { label: 'Me' },
    });

    const ops = opsByPath();
    expect(ops[slugPath('character', 'old-name')].op).toBe('delete');
    expect(ops[slugPath('character', 'new-name')].op).toBe('set');
    expect(ops[slugPath('character', 'new-name')].data).toEqual({ entityId: 'me' });
  });
});

describe('writeEntityWithProjections — fingerprint diff', () => {
  it('skips projection writes when the projected slice is unchanged', async () => {
    const FIRST_RUN = async () => {
      await writeEntityWithProjections(FAKE_FIRESTORE as never, {
        universeId: 'u1',
        kind: 'place',
        id: 'p1',
        canonicalCollection: 'places',
        canonical: { slug: 'ish', name: 'Ish' },
        slug: 'ish',
        directory: { label: 'Ishgard', secondary: 'A place' },
      });
    };

    await FIRST_RUN();

    // Reset op log; database keeps state.
    recordedOps = [];

    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'place',
      id: 'p1',
      canonicalCollection: 'places',
      canonical: { slug: 'ish', name: 'Ish v2' }, // canonical changes but projected slice does not
      slug: 'ish',
      directory: { label: 'Ishgard', secondary: 'A place' },
    });

    const ops = opsByPath();
    // Canonical was written.
    expect(ops[`${U}/places/p1`]).toBeDefined();
    expect(ops[`${U}/places/p1`].data).toMatchObject({ name: 'Ish v2' });
    // Directory projection write was skipped.
    expect(ops[dirPath('place', 'p1')]).toBeUndefined();
  });

  it('rewrites projections when label changes', async () => {
    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'place',
      id: 'p1',
      canonicalCollection: 'places',
      canonical: { slug: 'ish', name: 'Ish' },
      slug: 'ish',
      directory: { label: 'Ishgard' },
    });

    recordedOps = [];

    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'place',
      id: 'p1',
      canonicalCollection: 'places',
      canonical: { slug: 'ish', name: 'Ish' },
      slug: 'ish',
      directory: { label: 'Ishgard Restored' },
    });

    expect(opsByPath()[dirPath('place', 'p1')]).toBeDefined();
    expect(opsByPath()[dirPath('place', 'p1')].data).toMatchObject({ label: 'Ishgard Restored' });
  });
});

describe('writeEntityWithProjections — lane diff', () => {
  it('deletes lanes the entity left and writes new lanes when plotlineIds change', async () => {
    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'story',
      id: 's1',
      canonicalCollection: 'stories',
      canonical: { slug: 'opening', title: 'Opening', draft: false },
      slug: 'opening',
      directory: { label: 'Opening', draft: false },
      timeline: {
        title: 'Opening',
        inGameDate: { era: 'e1', year: 1577 },
        dateSortKey: 'k1',
        dateKnown: true,
        plotlineIds: ['pl-a', 'pl-b'],
        characterIds: [],
        placeIds: [],
      },
    });

    recordedOps = [];

    await writeEntityWithProjections(FAKE_FIRESTORE as never, {
      universeId: 'u1',
      kind: 'story',
      id: 's1',
      canonicalCollection: 'stories',
      canonical: { slug: 'opening', title: 'Opening v2', draft: false },
      slug: 'opening',
      directory: { label: 'Opening v2', draft: false }, // label change → fingerprint differs
      timeline: {
        title: 'Opening v2',
        inGameDate: { era: 'e1', year: 1577 },
        dateSortKey: 'k1',
        dateKnown: true,
        plotlineIds: ['pl-b', 'pl-c'], // pl-a removed, pl-c added
        characterIds: [],
        placeIds: [],
      },
    });

    const ops = opsByPath();
    expect(ops[lanePath('pl-a', 'story', 's1')].op).toBe('delete');
    expect(ops[lanePath('pl-b', 'story', 's1')].op).toBe('set');
    expect(ops[lanePath('pl-c', 'story', 's1')].op).toBe('set');
  });
});

describe('deleteEntityWithProjections', () => {
  it('deletes canonical, directory, timeline, slug-index, and every lane row', async () => {
    setDocs({
      [`${U}/stories/s1`]: { slug: 'opening', title: 'Opening' },
      [dirPath('story', 's1')]: { kind: 'story', entityId: 's1' },
      [timelinePath('story', 's1')]: { kind: 'story', plotlineIds: ['pl-a', 'pl-b'] },
      [slugPath('story', 'opening')]: { entityId: 's1' },
      [lanePath('pl-a', 'story', 's1')]: { laneKey: 'pl-a' },
      [lanePath('pl-b', 'story', 's1')]: { laneKey: 'pl-b' },
    });

    await deleteEntityWithProjections(FAKE_FIRESTORE as never, {
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

    await deleteEntityWithProjections(FAKE_FIRESTORE as never, {
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
