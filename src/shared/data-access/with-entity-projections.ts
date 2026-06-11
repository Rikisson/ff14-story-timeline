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
  entityRowKey,
  slugRowKey,
  TimelineRowInputs,
} from './projection-rows';

export type { DirectoryRowInputs, TimelineRowInputs };

/**
 * Projection-write primitives. Per `docs/backend-rules.md` *Write
 * discipline* + *Atomic slug uniqueness*: every canonical entity write
 * fans out to `_directory`, `_timelineEntries`, and `_slugIndex` rows
 * inside one `runTransaction`. The fan-out is
 * factored so callers can compose it with their own per-kind logic in
 * the same transaction — this is not a closed helper that hides the
 * transaction.
 *
 * ## Patch-merge inside the transaction
 *
 * Callers pass a `patch` (partial canonical) plus a `buildInputs`
 * callback. The helper reads the existing canonical inside the tx,
 * computes `merged = { ...existing, ...patch }`, calls `buildInputs(merged)`
 * to derive the projection inputs, and writes the merged result with
 * `tx.set`. This eliminates the stale-write race that a pre-merge
 * outside the transaction would expose: a concurrent edit landing
 * between an outer read and the eventual tx.set would be silently
 * clobbered by the caller's outdated full doc. With merge-in-tx the
 * tx's read sees the concurrent edit and the patch is applied on top.
 *
 * `patch` semantics: spread over existing. Setting a field to
 * `undefined` removes it (Firestore + `ignoreUndefinedProperties`).
 * Fields not present in the patch are preserved from existing.
 *
 * ## The composable primitives (preferred)
 *
 * `applyEntityWrite(tx, firestore, req)` and
 * `applyEntityDelete(tx, firestore, req)` accept a caller-owned
 * `Transaction`. Use them whenever the caller needs anything beyond a
 * flat canonical-plus-projections write — OCC version checks, extra
 * subdoc writes, multi-entity transactions.
 *
 * StoriesService is the canonical compose example. `saveStory` reads
 * metadata for the OCC check, calls `applyEntityWrite` for canonical
 * metadata + projections + slug claim, then writes the `_content/main`
 * subdoc — all in one `runTransaction`.
 *
 * Firestore's reads-before-writes rule still applies: caller tx.gets
 * must precede the `applyEntityWrite` call; `applyEntityWrite` does its
 * own reads first (canonical, directory, slug-claim) and then
 * all writes.
 *
 * ## The convenience wrappers
 *
 * `writeEntityWithProjections` / `deleteEntityWithProjections` own
 * their own `runTransaction` and call the primitive. Used by
 * `UniverseEntityService` for kinds without per-kind logic
 * (Character / Place / Event / Plotline / Codex). Story does NOT
 * use these.
 */

const DIRECTORY = '_directory';
const TIMELINE = '_timelineEntries';
const SLUG_INDEX = '_slugIndex';

const TIMELINE_KINDS: ReadonlySet<EntityKind> = new Set(['event', 'story']);

export interface EntityWriteRequest {
  universeId: string;
  kind: EntityKind;
  id: string;
  /** Canonical collection name (e.g. 'characters', 'events', 'stories'). */
  canonicalCollection: string;
  /**
   * Partial canonical payload. Spread over the existing doc inside the
   * transaction. For creates, this IS the full canonical (no existing
   * to merge against). For updates, patch fields override existing
   * fields; absent fields are preserved.
   */
  patch: Record<string, unknown>;
  /** Slug claim — written to `_slugIndex/{kind}_{slug}`. */
  slug: string;
  /**
   * Builds projection inputs from the post-merge canonical. The helper
   * invokes this AFTER computing `merged = { ...existing, ...patch }`
   * so per-kind builders see authoritative state. The merged value
   * includes the `id` for convenience.
   */
  buildInputs: (merged: Record<string, unknown> & { id: string }) => {
    directory: DirectoryRowInputs;
    timeline?: TimelineRowInputs;
  };
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
  const { universeId, kind, id, canonicalCollection, patch, slug, buildInputs } = req;

  // ---- READ PHASE (all tx.get must happen before any tx.set / tx.delete) ----

  const canonicalRef = doc(firestore, 'universes', universeId, canonicalCollection, id);
  const directoryRef = doc(firestore, 'universes', universeId, DIRECTORY, entityRowKey(kind, id));
  const timelineRef = TIMELINE_KINDS.has(kind)
    ? doc(firestore, 'universes', universeId, TIMELINE, entityRowKey(kind, id))
    : null;
  const newSlugRef = doc(firestore, 'universes', universeId, SLUG_INDEX, slugRowKey(kind, slug));

  const [canonicalSnap, directorySnap, newSlugSnap] = await Promise.all([
    tx.get(canonicalRef),
    tx.get(directoryRef),
    tx.get(newSlugRef),
  ]);

  const existing = canonicalSnap.exists() ? (canonicalSnap.data() as Record<string, unknown>) : {};
  const merged: Record<string, unknown> & { id: string } = { ...existing, ...patch, id };
  const prevSlug = typeof existing['slug'] === 'string' ? (existing['slug'] as string) : undefined;

  let oldSlugRef: ReturnType<typeof doc> | null = null;
  if (prevSlug && prevSlug !== slug) {
    oldSlugRef = doc(firestore, 'universes', universeId, SLUG_INDEX, slugRowKey(kind, prevSlug));
  }

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

  const inputs = buildInputs(merged);
  const built = await buildProjectionRows(
    { kind, id, slug, directory: inputs.directory, timeline: inputs.timeline },
    Date.now(),
  );

  const projectionsChanged = built.fingerprint !== prevFingerprint;

  // ---- WRITE PHASE ----

  // Strip `id` before writing canonical — id is the doc key, not a field.
  const { id: _id, ...canonicalToWrite } = merged;
  tx.set(canonicalRef, canonicalToWrite);

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
  }
}

export async function applyEntityDelete(
  tx: Transaction,
  firestore: Firestore,
  req: EntityDeleteRequest,
): Promise<void> {
  const { universeId, kind, id, canonicalCollection } = req;

  const canonicalRef = doc(firestore, 'universes', universeId, canonicalCollection, id);
  const directoryRef = doc(firestore, 'universes', universeId, DIRECTORY, entityRowKey(kind, id));
  const timelineRef = doc(firestore, 'universes', universeId, TIMELINE, entityRowKey(kind, id));

  const [canonicalSnap, timelineSnap] = await Promise.all([
    tx.get(canonicalRef),
    tx.get(timelineRef),
  ]);

  const prevCanonical = canonicalSnap.exists() ? (canonicalSnap.data() as Record<string, unknown>) : null;
  const prevSlug = prevCanonical && typeof prevCanonical['slug'] === 'string'
    ? (prevCanonical['slug'] as string)
    : undefined;

  tx.delete(canonicalRef);
  tx.delete(directoryRef);
  if (timelineSnap.exists()) tx.delete(timelineRef);
  if (prevSlug) {
    tx.delete(doc(firestore, 'universes', universeId, SLUG_INDEX, slugRowKey(kind, prevSlug)));
  }
}
