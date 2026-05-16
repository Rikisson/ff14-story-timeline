#!/usr/bin/env node
// scripts/rebuild-projections.mjs
//
// Walks every canonical doc in the target universe and rewrites the
// `_directory`, `_timelineEntries`, and `_timelineLaneEntries` rows
// from current canonical state. Idempotent — each row's fingerprint is
// derived from its current projected slice, not from prior projection
// state — so rerunning produces identical output.
//
// Use after schema changes, calendar config edits, category renames, or
// out-of-band Firestore console edits. Per docs `backend-rules.md`
// *Projection writers and rebuild*.
//
// Auth: signs in via Firebase Auth using FIREBASE_ADMIN_EMAIL and
// FIREBASE_ADMIN_PASSWORD environment variables. The user must be a
// member of the target universe (owner or editor) for the rules to
// permit projection writes.
//
// Usage:
//   FIREBASE_ADMIN_EMAIL=ops@example.com \
//   FIREBASE_ADMIN_PASSWORD=... \
//   node scripts/rebuild-projections.mjs <universeId>
//
// Limitations (v1, intentional):
//   - Skips `_slugIndex` rewriting (slugs are written at entity-create
//     time and are stable; rebuild has no reason to touch them).
//   - Skips orphan lane cleanup (rows from removed plotlineRefs persist
//     until the entity is edited again). Orphan removal is a separate
//     admin task.
//   - Story rebuild reads metadata only (universes/{u}/stories/{id});
//     the `_content/main` subdoc is never touched.

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  writeBatch,
} from 'firebase/firestore/lite';

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Firebase config — mirrors src/app/firebase.config.ts. Web API key only;
// per `backend-rules.md` *Pricing model awareness* this isn't a secret.
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: 'AIzaSyC2ICioH1E5qmNlk9jLmXFz31awItS55tU',
  authDomain: 'ff14-story-timeline.firebaseapp.com',
  projectId: 'ff14-story-timeline',
  messagingSenderId: '1063589458640',
  appId: '1:1063589458640:web:75590ccfe6cf0a599364d5',
};

const DIRECTORY = '_directory';
const TIMELINE = '_timelineEntries';
const LANE = '_timelineLaneEntries';
const UNASSIGNED_LANE = '__unassigned__';
const BATCH_OP_LIMIT = 450; // 500 is the hard cap; leave headroom for one entity's full fan-out

const KIND_TO_COLLECTION = {
  character: 'characters',
  place: 'places',
  event: 'events',
  story: 'stories',
  plotline: 'plotlines',
  codexEntry: 'codexEntries',
};

const PLOTLINE_STATUS_LABEL = {
  planned: 'Planned',
  active: 'Active',
  resolved: 'Resolved',
};

// ---------------------------------------------------------------------------
// Inlined shared utils — duplicates src/shared/utils/{fold-label,
// in-game-date-sort-key, source-fingerprint, in-game-date}.ts and the
// row-construction algorithm in src/shared/data-access/projection-rows.ts +
// the per-kind builders under src/features/*/data-access/*-projection.ts.
// Those TS modules are the reference implementation; this script is a port
// kept in lockstep so the CLI produces byte-identical projection rows to
// the live write path and the in-app `ProjectionRebuildService`. If you
// change the row shape, fingerprint algorithm, or any per-kind builder in
// TS, mirror the change here and rerun pnpm test to confirm the live-path
// specs still cover the new shape.
// ---------------------------------------------------------------------------

function foldLabel(value) {
  if (!value) return '';
  return value.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
}

function pad(n, width) {
  const v = Math.max(0, Math.floor(n));
  const s = String(v);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

function inGameDateSortKey(date, eraOrdinal) {
  if (!date) return '0'.repeat(28);
  const era = date.era ? eraOrdinal(date.era) ?? 0 : 0;
  return (
    pad(era, 4) +
    pad(date.year ?? 0, 7) +
    pad(date.month ?? 0, 2) +
    pad(date.day ?? 0, 3) +
    pad(date.hour ?? 0, 4) +
    pad(date.minute ?? 0, 4) +
    pad(date.second ?? 0, 4)
  );
}

function isInGameDateEmpty(d) {
  if (!d) return true;
  return (
    d.era === undefined &&
    d.year === undefined &&
    d.month === undefined &&
    d.day === undefined &&
    d.hour === undefined &&
    d.minute === undefined &&
    d.second === undefined &&
    !d.display
  );
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function buildDatePart(d, monthName) {
  const day = d.day;
  const month = d.month;
  if (day !== undefined && monthName) return `${day} ${monthName}`;
  if (day !== undefined && month !== undefined) return `Day ${day}, month ${pad2(month)}`;
  if (day !== undefined) return `day ${day}`;
  if (monthName) return monthName;
  if (month !== undefined) return `month ${pad2(month)}`;
  return '';
}

function buildTimePart(d) {
  if (d.hour === undefined) return '';
  const parts = [pad2(d.hour)];
  if (d.minute !== undefined) {
    parts.push(pad2(d.minute));
    if (d.second !== undefined) parts.push(pad2(d.second));
  }
  return parts.join(':');
}

function formatInGameDate(d, options = {}) {
  if (!d || isInGameDateEmpty(d)) return '';
  if (d.display) return d.display;
  const datePart = buildDatePart(d, options.monthName);
  const yearPart = d.year !== undefined ? String(d.year) : '';
  const timePart = buildTimePart(d);
  const eraName = options.eraName;
  let head;
  if (datePart && yearPart && eraName) head = `${datePart} of ${yearPart}, ${eraName}`;
  else if (datePart && yearPart) head = `${datePart} of ${yearPart}`;
  else if (datePart && eraName) head = `${datePart}, ${eraName}`;
  else if (datePart) head = datePart;
  else if (yearPart && eraName) head = `${yearPart} of the ${eraName}`;
  else if (yearPart) head = `the year ${yearPart}`;
  else if (eraName) head = eraName;
  else head = '';
  const body = !timePart ? head : head ? `${head} — ${timePart}` : timePart;
  if (options.weekdayName && body) return `${options.weekdayName} — ${body}`;
  if (options.weekdayName) return options.weekdayName;
  return body;
}

function getWeekdayIndex(d, options) {
  if (!d || d.year === undefined || d.month === undefined || d.day === undefined) return null;
  if (options.weekdayCount <= 0) return null;
  if (options.months.length === 0) return null;
  if (d.month < 1 || d.month > options.months.length) return null;
  if (d.year < 1 || d.day < 1) return null;
  const yearDays = options.months.reduce((sum, m) => sum + m.days, 0);
  if (yearDays <= 0) return null;
  let eraIndex;
  if (d.era === undefined) eraIndex = 0;
  else {
    eraIndex = options.eras.findIndex((e) => e.id === d.era);
    if (eraIndex < 0) return null;
  }
  if (options.eras.length === 0) return null;
  let anchorIndex = 0;
  for (let i = eraIndex; i >= 0; i--) {
    if (options.eras[i].resetsWeek || i === 0) {
      anchorIndex = i;
      break;
    }
  }
  let dayOffset = 0;
  for (let i = anchorIndex; i < eraIndex; i++) {
    const maxYears = options.eras[i].maxYears;
    if (maxYears === undefined) return null;
    dayOffset += maxYears * yearDays;
  }
  dayOffset += (d.year - 1) * yearDays;
  for (let m = 1; m < d.month; m++) dayOffset += options.months[m - 1].days;
  dayOffset += d.day - 1;
  const n = options.weekdayCount;
  return ((dayOffset % n) + n) % n;
}

function canonicalise(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed.normalize('NFC');
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const cleaned = value.map(canonicalise).filter((v) => v !== null);
    if (cleaned.length === 0) return null;
    if (cleaned.every((v) => typeof v === 'string')) return [...cleaned].sort();
    return cleaned;
  }
  const keys = Object.keys(value).sort();
  const out = {};
  for (const key of keys) {
    const v = canonicalise(value[key]);
    if (v === null) continue;
    out[key] = v;
  }
  return Object.keys(out).length === 0 ? null : out;
}

function computeSourceFingerprint(slice) {
  const payload = JSON.stringify(canonicalise(slice));
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Per-kind projection builders. Mirrors the entity services' toDirectoryInputs
// / toTimelineInputs methods. Keep these in lockstep with the live code paths
// — divergence shows up as fingerprint drift, which triggers a one-time
// re-write on the next live entity edit but is otherwise harmless.
// ---------------------------------------------------------------------------

function buildDirectoryInputs(kind, entity, ctx) {
  switch (kind) {
    case 'character':
    case 'place':
      return { label: entity.name, coverAssetId: entity.coverAssetId };
    case 'event': {
      const date = entity.inGameDate ?? {};
      return {
        label: entity.name,
        coverAssetId: entity.coverAssetId,
        secondary: isInGameDateEmpty(date) ? undefined : formatDateSecondary(date, ctx.calendar) || undefined,
      };
    }
    case 'story': {
      const date = entity.inGameDate ?? {};
      return {
        label: entity.title,
        coverAssetId: entity.coverAssetId,
        secondary: isInGameDateEmpty(date) ? undefined : formatDateSecondary(date, ctx.calendar) || undefined,
        draft: entity.draft,
      };
    }
    case 'plotline':
      return {
        label: entity.title,
        coverAssetId: entity.coverAssetId,
        status: entity.status,
        secondary: entity.status ? PLOTLINE_STATUS_LABEL[entity.status] : undefined,
      };
    case 'codexEntry':
      return {
        label: entity.title,
        coverAssetId: entity.coverAssetId,
        categoryKey: entity.categoryKey,
        secondary: entity.categoryKey
          ? ctx.categoryLabelByKey.get(entity.categoryKey)
          : undefined,
      };
    default:
      throw new Error(`Unsupported kind: ${kind}`);
  }
}

function buildTimelineInputs(kind, entity, ctx) {
  if (kind !== 'event' && kind !== 'story') return null;
  const date = entity.inGameDate ?? {};
  const eraOrdinal = (id) => ctx.calendar.eraOrdinalById.get(id);
  return {
    title: kind === 'story' ? entity.title : entity.name,
    coverAssetId: entity.coverAssetId,
    inGameDate: date,
    dateSortKey: inGameDateSortKey(date, eraOrdinal),
    dateKnown: !isInGameDateEmpty(date),
    plotlineIds: (entity.plotlineRefs ?? []).map((r) => r.id),
    characterIds: (entity.relatedRefs ?? []).filter((r) => r.kind === 'character').map((r) => r.id),
    placeIds: (entity.relatedRefs ?? []).filter((r) => r.kind === 'place').map((r) => r.id),
  };
}

function formatDateSecondary(date, calendar) {
  if (isInGameDateEmpty(date)) return undefined;
  const eraName = date.era ? calendar.eraNameById.get(date.era) : undefined;
  const monthName =
    date.month !== undefined ? calendar.monthNameByIndex.get(date.month) : undefined;
  const weekdayName = (() => {
    const wds = calendar.weekdays ?? [];
    if (wds.length === 0) return undefined;
    const idx = getWeekdayIndex(date, {
      eras: calendar.eras,
      months: calendar.months,
      weekdayCount: wds.length,
    });
    return idx === null ? undefined : wds[idx]?.name;
  })();
  const out = formatInGameDate(date, { eraName, monthName, weekdayName });
  return out || undefined;
}

// ---------------------------------------------------------------------------
// Projection write fan-out (writeBatch ops)
// ---------------------------------------------------------------------------

function rowKey(kind, id) {
  return `${kind}_${id}`;
}

function laneRowKey(laneId, kind, id) {
  return `${laneId}_${kind}_${id}`;
}

function laneIdsOf(plotlineIds) {
  return plotlineIds.length === 0 ? [UNASSIGNED_LANE] : plotlineIds;
}

function setIfDefined(obj, key, value) {
  if (value !== undefined) obj[key] = value;
}

function buildProjectionRows(firestore, universeId, kind, id, entity, ctx) {
  const dir = buildDirectoryInputs(kind, entity, ctx);
  const timeline = buildTimelineInputs(kind, entity, ctx);
  const draft = dir.draft;
  const visiblePublic = draft !== true;
  const updatedAt = entity.updatedAt ?? entity.createdAt ?? Date.now();

  const directoryRow = {
    kind,
    entityId: id,
    label: dir.label,
    labelFolded: foldLabel(dir.label),
    slug: entity.slug,
    visiblePublic,
  };
  setIfDefined(directoryRow, 'coverAssetId', dir.coverAssetId);
  setIfDefined(directoryRow, 'secondary', dir.secondary);
  setIfDefined(directoryRow, 'categoryKey', dir.categoryKey);
  setIfDefined(directoryRow, 'status', dir.status);
  setIfDefined(directoryRow, 'draft', draft);

  let timelineRow = null;
  let laneIds = [];
  if (timeline) {
    timelineRow = {
      kind,
      entityId: id,
      title: timeline.title,
      inGameDate: timeline.inGameDate,
      dateSortKey: timeline.dateSortKey,
      dateKnown: timeline.dateKnown,
      plotlineIds: timeline.plotlineIds,
      characterIds: timeline.characterIds,
      placeIds: timeline.placeIds,
      draft: draft === true,
      visiblePublic,
    };
    setIfDefined(timelineRow, 'coverAssetId', timeline.coverAssetId);
    laneIds = laneIdsOf(timeline.plotlineIds);
  }

  const fingerprint = computeSourceFingerprint({
    directory: directoryRow,
    timeline: timelineRow,
  });

  directoryRow.sourceFingerprint = fingerprint;
  directoryRow.updatedAt = updatedAt;
  if (timelineRow) {
    timelineRow.sourceFingerprint = fingerprint;
    timelineRow.updatedAt = updatedAt;
  }

  const ops = [];
  ops.push({
    ref: doc(firestore, 'universes', universeId, DIRECTORY, rowKey(kind, id)),
    data: directoryRow,
  });
  if (timelineRow) {
    ops.push({
      ref: doc(firestore, 'universes', universeId, TIMELINE, rowKey(kind, id)),
      data: timelineRow,
    });
    for (const laneId of laneIds) {
      ops.push({
        ref: doc(
          firestore,
          'universes',
          universeId,
          LANE,
          laneRowKey(laneId, kind, id),
        ),
        data: { ...timelineRow, laneKey: laneId },
      });
    }
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function loadUniverseContext(firestore, universeId) {
  const calendarSnap = await getDoc(
    doc(firestore, 'universes', universeId, '_meta', 'calendar'),
  );
  const calendarDoc = calendarSnap.exists() ? calendarSnap.data() : { eras: [], months: [] };
  const eras = calendarDoc.eras ?? [];
  const months = calendarDoc.months ?? [];
  const weekdays = calendarDoc.weekdays ?? [];

  const eraOrdinalById = new Map();
  const eraNameById = new Map();
  eras.forEach((e, i) => {
    eraOrdinalById.set(e.id, i);
    eraNameById.set(e.id, e.name);
  });
  const monthNameByIndex = new Map();
  months.forEach((m, i) => monthNameByIndex.set(i + 1, m.name));

  const calendar = { eras, months, weekdays, eraOrdinalById, eraNameById, monthNameByIndex };

  const categoriesSnap = await getDoc(
    doc(firestore, 'universes', universeId, '_meta', 'codex_categories'),
  );
  const categoriesDoc = categoriesSnap.exists() ? categoriesSnap.data() : { categories: [] };
  const categoryLabelByKey = new Map();
  for (const c of categoriesDoc.categories ?? []) {
    if (c.key) categoryLabelByKey.set(c.key, c.label);
  }

  return { calendar, categoryLabelByKey };
}

async function rebuildKind(firestore, universeId, kind, ctx) {
  const collectionName = KIND_TO_COLLECTION[kind];
  const snap = await getDocs(
    collection(firestore, 'universes', universeId, collectionName),
  );
  console.log(`  ${kind}: ${snap.docs.length} canonical docs`);

  let batch = writeBatch(firestore);
  let opCount = 0;
  let committed = 0;

  for (const d of snap.docs) {
    const entity = { id: d.id, ...d.data() };
    const ops = buildProjectionRows(firestore, universeId, kind, d.id, entity, ctx);

    if (opCount + ops.length > BATCH_OP_LIMIT) {
      await batch.commit();
      committed += opCount;
      batch = writeBatch(firestore);
      opCount = 0;
    }

    for (const { ref, data } of ops) {
      batch.set(ref, data);
      opCount++;
    }
  }

  if (opCount > 0) {
    await batch.commit();
    committed += opCount;
  }

  console.log(`  ${kind}: committed ${committed} projection ops`);
}

async function main() {
  const universeId = process.argv[2];
  if (!universeId) {
    console.error('Usage: node scripts/rebuild-projections.mjs <universeId>');
    process.exit(1);
  }
  const email = process.env['FIREBASE_ADMIN_EMAIL'];
  const password = process.env['FIREBASE_ADMIN_PASSWORD'];
  if (!email || !password) {
    console.error('FIREBASE_ADMIN_EMAIL and FIREBASE_ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const firestore = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const auth = getAuth(app);

  console.log(`Signing in as ${email}...`);
  await signInWithEmailAndPassword(auth, email, password);

  console.log(`Loading universe context for ${universeId}...`);
  const ctx = await loadUniverseContext(firestore, universeId);

  console.log(`Rebuilding projections for universe ${universeId}...`);
  for (const kind of Object.keys(KIND_TO_COLLECTION)) {
    await rebuildKind(firestore, universeId, kind, ctx);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Rebuild failed:', err);
  process.exit(1);
});
