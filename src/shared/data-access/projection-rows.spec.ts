import { describe, expect, it } from 'vitest';
import { buildProjectionRows } from './projection-rows';

const FIXED_TS = 1700000000000;

describe('buildProjectionRows — directory row shape', () => {
  it('builds a minimal directory row for a flat entity', async () => {
    const out = await buildProjectionRows(
      {
        kind: 'character',
        id: 'c1',
        slug: 'aria',
        directory: { label: 'Aria' },
      },
      FIXED_TS,
    );

    expect(out.directoryRow).toMatchObject({
      kind: 'character',
      entityId: 'c1',
      label: 'Aria',
      labelFolded: 'aria',
      slug: 'aria',
      visiblePublic: true,
      updatedAt: FIXED_TS,
    });
    expect(out.directoryRow['sourceFingerprint']).toMatch(/^[0-9a-f]{12}$/);
    expect(out.timelineRow).toBeNull();
  });

  it('drops draft entities from visiblePublic and tags the row', async () => {
    const out = await buildProjectionRows(
      {
        kind: 'story',
        id: 's1',
        slug: 'wip',
        directory: { label: 'WIP', draft: true },
      },
      FIXED_TS,
    );
    expect(out.directoryRow).toMatchObject({ visiblePublic: false, draft: true });
  });

  it('passes through coverAssetId, secondary, categoryKey, status when defined', async () => {
    const out = await buildProjectionRows(
      {
        kind: 'codexEntry',
        id: 'cx1',
        slug: 'phoenix-dawn',
        directory: {
          label: 'Phoenix Dawn',
          coverAssetId: 'a1',
          secondary: 'Faction',
          categoryKey: 'faction',
        },
      },
      FIXED_TS,
    );
    expect(out.directoryRow).toMatchObject({
      coverAssetId: 'a1',
      secondary: 'Faction',
      categoryKey: 'faction',
    });
  });

  it('uses caller-provided labelFolded when present, otherwise folds the label', async () => {
    const a = await buildProjectionRows(
      { kind: 'place', id: 'p1', slug: 'ish', directory: { label: 'Ishgard' } },
      FIXED_TS,
    );
    const b = await buildProjectionRows(
      { kind: 'place', id: 'p1', slug: 'ish', directory: { label: 'Ishgard', labelFolded: 'ish' } },
      FIXED_TS,
    );
    expect(a.directoryRow['labelFolded']).toBe('ishgard');
    expect(b.directoryRow['labelFolded']).toBe('ish');
  });
});

describe('buildProjectionRows — timeline row', () => {
  const baseTimeline = {
    title: 'Opening',
    inGameDate: { era: 'e1', year: 1577 },
    dateSortKey: '00010001577000000000000000000',
    dateKnown: true,
    plotlineIds: ['pl-a', 'pl-b'],
    characterIds: ['c1'],
    placeIds: ['p1'],
  };

  it('carries the plotline / character / place id arrays', async () => {
    const out = await buildProjectionRows(
      {
        kind: 'story',
        id: 's1',
        slug: 'opening',
        directory: { label: 'Opening' },
        timeline: baseTimeline,
      },
      FIXED_TS,
    );

    expect(out.timelineRow).toMatchObject({
      plotlineIds: ['pl-a', 'pl-b'],
      characterIds: ['c1'],
      placeIds: ['p1'],
    });
  });

  it('mirrors draft + visiblePublic onto the timeline row', async () => {
    const out = await buildProjectionRows(
      {
        kind: 'story',
        id: 's-draft',
        slug: 'wip',
        directory: { label: 'WIP', draft: true },
        timeline: { ...baseTimeline, plotlineIds: [] },
      },
      FIXED_TS,
    );
    expect(out.timelineRow).toMatchObject({ draft: true, visiblePublic: false });
  });
});

describe('buildProjectionRows — fingerprint determinism', () => {
  it('produces the same fingerprint for two equivalent inputs', async () => {
    const inputs = {
      kind: 'story' as const,
      id: 's1',
      slug: 'opening',
      directory: { label: 'Opening', secondary: 'Spring 1577' },
      timeline: {
        title: 'Opening',
        inGameDate: { era: 'e1', year: 1577 },
        dateSortKey: 'k',
        dateKnown: true,
        plotlineIds: ['pl-b', 'pl-a'],
        characterIds: ['c2', 'c1'],
        placeIds: [],
      },
    };
    const a = await buildProjectionRows(inputs, FIXED_TS);
    const b = await buildProjectionRows(inputs, FIXED_TS + 12345); // updatedAt differs
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('changes the fingerprint when a projected field changes', async () => {
    const a = await buildProjectionRows(
      {
        kind: 'character',
        id: 'c1',
        slug: 'aria',
        directory: { label: 'Aria' },
      },
      FIXED_TS,
    );
    const b = await buildProjectionRows(
      {
        kind: 'character',
        id: 'c1',
        slug: 'aria',
        directory: { label: 'Aria Brann' },
      },
      FIXED_TS,
    );
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('writes the fingerprint onto every produced row', async () => {
    const out = await buildProjectionRows(
      {
        kind: 'event',
        id: 'e1',
        slug: 'fall',
        directory: { label: 'Fall' },
        timeline: {
          title: 'Fall',
          inGameDate: { era: 'e1', year: 1572 },
          dateSortKey: 'k',
          dateKnown: true,
          plotlineIds: ['pl-a'],
          characterIds: [],
          placeIds: [],
        },
      },
      FIXED_TS,
    );
    expect(out.directoryRow['sourceFingerprint']).toBe(out.fingerprint);
    expect(out.timelineRow!['sourceFingerprint']).toBe(out.fingerprint);
  });
});
