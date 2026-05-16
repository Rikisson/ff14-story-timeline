import {
  doc,
  Firestore,
  runTransaction,
  Transaction,
} from 'firebase/firestore/lite';
import { EntityKind, SlugTakenError } from '@shared/models';
import {
  buildProjectionRows,
  DirectoryRowInputs,
  directoryRowKey,
  laneIdsOf,
  ProjectionRowsInputs,
  slugRowKey,
  timelineRowKey,
  TimelineRowInputs,
  UNASSIGNED_LANE_KEY,
} from './projection-rows';

export { UNASSIGNED_LANE_KEY };
export type { DirectoryRowInputs, TimelineRowInputs };

/**
 * Projection-write primitives. Per `docs/backend-rules.md` *Write
 * discipline* + *Atomic slug uniqueness*: every canonical entity write
 * fans out to `_directory`, `_timelineEntries`, `_timelineLaneEntries`,
 * and `_slugIndex` rows inside one `runTransaction`. The fan-out is
 * factored so callers can compose it with their own per-kind logic in
 * the same transaction — this is not a closed helper that hides the
 * transaction.
 *
 * ## The composable primitives (preferred)
 *
 * `applyEntityWrite(tx, firestore, req)` and
 * `applyEntityDelete(tx, firestore, req)` accept a caller-owned
 * `Transaction` and contribute their reads + writes to it. Use them
 * whenever the caller needs to do anything beyond a flat
 * canonical-plus-projections write — OCC version checks, extra subdoc
 * writes, multi-entity transactions, etc.
 *
 * StoriesService is the canonical compose example. `saveStory` reads
 * metadata for the OCC check, calls `applyEntityWrite` for canonical
 * metadata + projections + slug claim, then writes the `_content/main`
 * subdoc — all in one `runTransaction`:
 *
 *     return runTransaction(firestore, async (tx) => {
 *       const metaSnap = await tx.get(metaRef);
 *       if (metaSnap.exists() && metaSnap.data().version !== expected) {
 *         throw new StaleStoryError(...);
 *       }
 *       await applyEntityWrite(tx, firestore, {
 *         universeId, kind: 'story', id, canonicalCollection: 'stories',
 *         canonical, slug, directory, timeline,
 *       });
 *       tx.set(contentRef, content);
 *       return nextVersion;
 *     });
 *
 * Note Firestore's reads-before-writes rule: any tx.get the caller
 * issues must run before `applyEntityWrite` returns and before any
 * tx.set / tx.delete. `applyEntityWrite` does its own reads first
 * (canonical, directory, timeline, new slug claim) and then all writes,
 * so caller reads must precede the `applyEntityWrite` call.
 *
 * ## The convenience wrappers
 *
 * `writeEntityWithProjections` / `deleteEntityWithProjections` own
 * their own `runTransaction` and call the primitive. Use them only for
 * kinds with no per-kind logic in the write path — Character, Place,
 * Event, Plotline, Codex via `UniverseEntityService`. Story does NOT
 * use these.
 *
 * ## Caller responsibilities
 *
 * Secondary computation (`Directory.secondary`) is the caller's job —
 * by the time the request reaches this helper, the string is already
 * resolved. Keeps the helper free of cross-entity reads beyond its own
 * slug / fingerprint diffs. The row-shape construction itself lives in
 * `./projection-rows.ts` and is shared with `ProjectionRebuildService`
 * and the CLI rebuild script.
 */

const DIRECTORY = '_directory';
const TIMELINE = '_timelineEntries';
const LANE = '_timelineLaneEntries';
const SLUG_INDEX = '_slugIndex';

export interface EntityWriteRequest extends ProjectionRowsInputs {
  universeId: string;
  /** Canonical collection name (e.g. 'characters', 'events', 'stories'). */
  canonicalCollection: string;
  /** Canonical doc payload written verbatim. Caller is responsible for OCC version stamps. */
  canonical: Record<string, unknown>;
}

export interface EntityDeleteRequest {
  universeId: string;
  kind: EntityKind;
  id: string;
  canonicalCollection: string;
}

export async function writeEntityWithProjections(
  firestore: Firestore,
  req: EntityWriteRequest,
): Promise<void> {
  await runTransaction(firestore, (tx) => applyEntityWrite(tx, firestore, req));
}

export async function deleteEntityWithProjections(
  firestore: Firestore,
  req: EntityDeleteRequest,
): Promise<void> {
  await runTransaction(firestore, (tx) => applyEntityDelete(tx, firestore, req));
}

export async function applyEntityWrite(
  tx: Transaction,
  firestore: Firestore,
  req: EntityWriteRequest,
): Promise<void> {
  const { universeId, kind, id, canonicalCollection, canonical, slug, directory, timeline } = req;

  // ---- READ PHASE (all tx.get must happen before any tx.set / tx.delete) ----

  const canonicalRef = doc(firestore, 'universes', universeId, canonicalCollection, id);
  const directoryRef = doc(firestore, 'universes', universeId, DIRECTORY, directoryRowKey(kind, id));
  const timelineRef = timeline
    ? doc(firestore, 'universes', universeId, TIMELINE, timelineRowKey(kind, id))
    : null;
  const newSlugRef = doc(firestore, 'universes', universeId, SLUG_INDEX, slugRowKey(kind, slug));

  const [canonicalSnap, directorySnap, timelineSnap, newSlugSnap] = await Promise.all([
    tx.get(canonicalRef),
    tx.get(directoryRef),
    timelineRef ? tx.get(timelineRef) : Promise.resolve(null),
    tx.get(newSlugRef),
  ]);

  const prevCanonical = canonicalSnap.exists() ? (canonicalSnap.data() as Record<string, unknown>) : null;
  const prevSlug = prevCanonical && typeof prevCanonical['slug'] === 'string'
    ? (prevCanonical['slug'] as string)
    : undefined;

  let oldSlugRef: ReturnType<typeof doc> | null = null;
  if (prevSlug && prevSlug !== slug) {
    oldSlugRef = doc(firestore, 'universes', universeId, SLUG_INDEX, slugRowKey(kind, prevSlug));
  }

  const prevLaneIds = timelineSnap && timelineSnap.exists()
    ? laneIdsOf((timelineSnap.data() as TimelineRowInputs).plotlineIds ?? [])
    : [];
  const prevFingerprint = directorySnap.exists()
    ? ((directorySnap.data() as { sourceFingerprint?: string }).sourceFingerprint)
    : undefined;

  // ---- VALIDATE ----

  if (newSlugSnap.exists()) {
    const owner = (newSlugSnap.data() as { entityId?: string }).entityId;
    if (owner && owner !== id) {
      throw new SlugTakenError(kind, slug);
    }
  }

  // ---- BUILD ROWS (shared with rebuild paths) ----

  const built = await buildProjectionRows(
    { kind, id, slug, directory, timeline },
    Date.now(),
  );

  const projectionsChanged = built.fingerprint !== prevFingerprint;

  // ---- WRITE PHASE ----

  tx.set(canonicalRef, canonical);

  if (!newSlugSnap.exists()) {
    tx.set(newSlugRef, { entityId: id });
  }
  if (oldSlugRef) {
    tx.delete(oldSlugRef);
  }

  if (!projectionsChanged) return;

  tx.set(directoryRef, built.directoryRow);
  if (timelineRef && built.timelineRow) {
    tx.set(timelineRef, built.timelineRow);

    const newLaneKeys = new Set(built.laneRows.map((l) => l.laneKey));
    for (const lane of built.laneRows) {
      const laneRef = doc(firestore, 'universes', universeId, LANE, lane.rowKey);
      tx.set(laneRef, lane.row);
    }
    for (const laneId of prevLaneIds) {
      if (newLaneKeys.has(laneId)) continue;
      const laneRef = doc(
        firestore,
        'universes',
        universeId,
        LANE,
        `${laneId}_${kind}_${id}`,
      );
      tx.delete(laneRef);
    }
  }
}

export async function applyEntityDelete(
  tx: Transaction,
  firestore: Firestore,
  req: EntityDeleteRequest,
): Promise<void> {
  const { universeId, kind, id, canonicalCollection } = req;

  const canonicalRef = doc(firestore, 'universes', universeId, canonicalCollection, id);
  const directoryRef = doc(firestore, 'universes', universeId, DIRECTORY, directoryRowKey(kind, id));
  const timelineRef = doc(firestore, 'universes', universeId, TIMELINE, timelineRowKey(kind, id));

  const [canonicalSnap, timelineSnap] = await Promise.all([
    tx.get(canonicalRef),
    tx.get(timelineRef),
  ]);

  const prevCanonical = canonicalSnap.exists() ? (canonicalSnap.data() as Record<string, unknown>) : null;
  const prevSlug = prevCanonical && typeof prevCanonical['slug'] === 'string'
    ? (prevCanonical['slug'] as string)
    : undefined;
  const prevLaneIds = timelineSnap.exists()
    ? laneIdsOf((timelineSnap.data() as TimelineRowInputs).plotlineIds ?? [])
    : [];

  tx.delete(canonicalRef);
  tx.delete(directoryRef);
  if (timelineSnap.exists()) tx.delete(timelineRef);
  if (prevSlug) {
    tx.delete(doc(firestore, 'universes', universeId, SLUG_INDEX, slugRowKey(kind, prevSlug)));
  }
  for (const laneId of prevLaneIds) {
    tx.delete(doc(firestore, 'universes', universeId, LANE, `${laneId}_${kind}_${id}`));
  }
}
