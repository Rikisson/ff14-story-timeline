import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import {
  collection,
  doc,
  documentId,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import {
  CalendarProjectionContext,
  CalendarService,
} from '@features/calendar';
import { buildCharacterDirectoryInputs } from '../../features/characters/data-access/character-projection';
import {
  buildCodexEntryDirectoryInputs,
  CodexCategoriesProjectionContext,
} from '../../features/codex/data-access/codex-entry-projection';
import { CodexCategoriesService } from '../../features/codex/data-access/codex-categories.service';
import {
  buildEventDirectoryInputs,
  buildEventTimelineInputs,
} from '../../features/events/data-access/event-projection';
import { buildPlaceDirectoryInputs } from '../../features/places/data-access/place-projection';
import { buildPlotlineDirectoryInputs } from '../../features/plotlines/data-access/plotline-projection';
import {
  buildStoryDirectoryInputs,
  buildStoryTimelineInputs,
} from '../../features/stories/data-access/story-projection';
import {
  buildProjectionRows,
  CacheInvalidationBus,
  DirectoryRowInputs,
  entityRowKey,
  ProjectionRowsInputs,
  slugRowKey,
  TimelineRowInputs,
} from '@shared/data-access';
import { EntityKind } from '@shared/models';
import { FirebaseService } from '../firebase/firebase.service';

/**
 * Client-side chunked projection rebuild. Per `docs/backend-rules.md`
 * *Write discipline* + *Projection writers and rebuild*: three lifecycle
 * transitions trigger a scoped rebuild that doesn't fit in a single
 * transaction.
 *
 *   - **Calendar config change** invalidates every story / event's
 *     `dateSortKey`. Call `rebuildForCalendarChange(universeId)` from
 *     the calendar settings save flow — the save modal blocks behind
 *     this until the rebuild completes.
 *   - **Category rename** dirties every codex directory row whose
 *     `categoryKey` matches. Call `rebuildForCategoryRename(universeId,
 *     categoryKey)` from the categories settings flow; the UI shows a
 *     toast with progress.
 *   - **Ad-hoc recovery** after schema changes or out-of-band edits.
 *     `rebuildKind(universeId, kind)` walks a single kind end-to-end.
 *
 * Writes are chunked via `writeBatch` (≤450 ops to leave headroom for
 * one entity's full fan-out under the 500-op cap).
 *
 * ## Orphan sweep
 *
 * `rebuildKind` and `rebuildForCalendarChange` invoke an orphan-sweep
 * pass after the canonical walk: rows in `_directory` /
 * `_timelineEntries` / `_slugIndex` whose `entityId` no longer matches
 * any canonical doc are deleted. Without this, deleted entities leak
 * as stale rows.
 *
 * `rebuildForCategoryRename` does NOT sweep — it's a targeted refresh
 * of one categoryKey, not a full rebuild, and a sweep would walk every
 * codex row in the universe just to delete nothing.
 *
 * Rebuilt rows carry byte-identical fingerprints to a fresh live write
 * because both paths go through `buildProjectionRows` + the per-kind
 * `build*DirectoryInputs` / `build*TimelineInputs` modules.
 */

const BATCH_OP_LIMIT = 450;
const DIRECTORY = '_directory';
const TIMELINE = '_timelineEntries';
const SLUG_INDEX = '_slugIndex';

const KIND_TO_COLLECTION: Record<EntityKind, string> = {
  character: 'characters',
  place: 'places',
  event: 'events',
  story: 'stories',
  plotline: 'plotlines',
  codexEntry: 'codexEntries',
};

const TIMELINE_KINDS: ReadonlySet<EntityKind> = new Set(['event', 'story']);

export interface RebuildProgress {
  phase: 'idle' | 'starting' | 'processing' | 'done' | 'error';
  /** Rows processed so far across all kinds visited this run. */
  processed: number;
  /** Total rows discovered so far. Inflates as more kinds are walked. */
  total: number;
  /** Most recent kind being processed, if any. */
  currentKind?: EntityKind;
  /** Last error message if `phase === 'error'`. */
  error?: string;
}

const IDLE: RebuildProgress = { phase: 'idle', processed: 0, total: 0 };

interface WalkResult {
  canonicalIds: Set<string>;
}

@Injectable({ providedIn: 'root' })
export class ProjectionRebuildService {
  private readonly firebase = inject(FirebaseService);
  private readonly calendar = inject(CalendarService);
  private readonly categoriesService = inject(CodexCategoriesService);
  private readonly bus = inject(CacheInvalidationBus);

  private readonly _progress = signal<RebuildProgress>(IDLE);
  /** Read-only progress signal — bind to it from a progress modal / toast. */
  readonly progress: Signal<RebuildProgress> = this._progress.asReadonly();
  readonly inFlight = computed(() => {
    const p = this._progress();
    return p.phase === 'starting' || p.phase === 'processing';
  });

  async rebuildForCalendarChange(universeId: string): Promise<void> {
    return this.run(async () => {
      await this.calendar.refresh(universeId);
      await this.rebuildKindInternal(universeId, 'event');
      await this.rebuildKindInternal(universeId, 'story');
    });
  }

  async rebuildForCategoryRename(
    universeId: string,
    categoryKey: string,
  ): Promise<void> {
    return this.run(async () => {
      await this.categoriesService.refresh(universeId);
      const ctx = this.codexContext();
      const snap = await getDocs(
        query(
          collection(this.firebase.firestore, 'universes', universeId, 'codexEntries'),
          where('categoryKey', '==', categoryKey),
        ),
      );
      this.bumpTotal(snap.docs.length);
      this._progress.update((p) => ({ ...p, currentKind: 'codexEntry' }));
      await this.writeCodexRows(universeId, snap.docs, ctx);
      // Intentional: no orphan sweep here — this is a targeted refresh.
    });
  }

  async rebuildKind(universeId: string, kind: EntityKind): Promise<void> {
    return this.run(async () => {
      if (TIMELINE_KINDS.has(kind)) await this.calendar.refresh(universeId);
      if (kind === 'codexEntry') await this.categoriesService.refresh(universeId);
      await this.rebuildKindInternal(universeId, kind);
    });
  }

  private async rebuildKindInternal(universeId: string, kind: EntityKind): Promise<void> {
    const collectionName = KIND_TO_COLLECTION[kind];
    const snap = await getDocs(
      collection(this.firebase.firestore, 'universes', universeId, collectionName),
    );
    this.bumpTotal(snap.docs.length);
    this._progress.update((p) => ({ ...p, currentKind: kind }));

    const result = await this.writeKindRows(universeId, kind, snap.docs);
    await this.sweepOrphans(universeId, kind, result);
  }

  // -------------------------------------------------------------------------
  // Per-kind canonical walks. Each returns the walked canonical IDs so
  // the subsequent sweep pass can identify orphans without re-reading.
  // -------------------------------------------------------------------------

  private async writeKindRows(
    universeId: string,
    kind: EntityKind,
    docs: ReadonlyArray<FsDoc>,
  ): Promise<WalkResult> {
    if (kind === 'event') return this.writeEventRows(universeId, docs);
    if (kind === 'story') return this.writeStoryRows(universeId, docs);
    if (kind === 'codexEntry') return this.writeCodexRows(universeId, docs, this.codexContext());
    if (kind === 'plotline') return this.writeFlatRows(universeId, 'plotline', docs, (e) => buildPlotlineDirectoryInputs(e as never));
    if (kind === 'character') return this.writeFlatRows(universeId, 'character', docs, (e) => buildCharacterDirectoryInputs(e as never));
    if (kind === 'place') return this.writeFlatRows(universeId, 'place', docs, (e) => buildPlaceDirectoryInputs(e as never));
    throw new Error(`Unsupported kind: ${kind satisfies never}`);
  }

  private writeFlatRows(
    universeId: string,
    kind: EntityKind,
    docs: ReadonlyArray<FsDoc>,
    buildDirectory: (entity: Record<string, unknown> & { id: string }) => DirectoryRowInputs,
  ): Promise<WalkResult> {
    return this.runWalk(universeId, kind, docs, (entity) => ({
      directory: buildDirectory(entity),
    }));
  }

  private writeEventRows(universeId: string, docs: ReadonlyArray<FsDoc>): Promise<WalkResult> {
    const ctx = this.calendarContext();
    return this.runWalk(universeId, 'event', docs, (entity) => ({
      directory: buildEventDirectoryInputs(entity as never, ctx),
      timeline: buildEventTimelineInputs(entity as never, ctx),
    }));
  }

  private writeStoryRows(universeId: string, docs: ReadonlyArray<FsDoc>): Promise<WalkResult> {
    const ctx = this.calendarContext();
    return this.runWalk(universeId, 'story', docs, (entity) => ({
      directory: buildStoryDirectoryInputs(entity as never, ctx),
      timeline: buildStoryTimelineInputs(entity as never, ctx),
    }));
  }

  private writeCodexRows(
    universeId: string,
    docs: ReadonlyArray<FsDoc>,
    ctx: CodexCategoriesProjectionContext,
  ): Promise<WalkResult> {
    return this.runWalk(universeId, 'codexEntry', docs, (entity) => ({
      directory: buildCodexEntryDirectoryInputs(entity as never, ctx),
    }));
  }

  private async runWalk(
    universeId: string,
    kind: EntityKind,
    docs: ReadonlyArray<FsDoc>,
    buildInputs: (entity: Record<string, unknown> & { id: string }) => {
      directory: DirectoryRowInputs;
      timeline?: TimelineRowInputs;
    },
  ): Promise<WalkResult> {
    const canonicalIds = new Set<string>();
    let batch = writeBatch(this.firebase.firestore);
    let opCount = 0;
    // Cache-bus events MUST fire after the corresponding batch commits,
    // otherwise active stores refetch the stale row and never get
    // re-notified once the new data lands. `applyOps` returns the set of
    // IDs whose ops landed in a now-committed batch — those get
    // published immediately. The rest stay queued until the final commit
    // below.
    let pendingForBatch: string[] = [];
    const publish = (ids: readonly string[]): void => {
      for (const id of ids) this.bus.publishEntityWrite({ universeId, kind, id });
    };

    for (const d of docs) {
      const raw = d.data();
      const entity = { id: d.id, ...raw };
      const inputs = buildInputs(entity);
      canonicalIds.add(d.id);

      const rowsInputs: ProjectionRowsInputs = {
        kind,
        id: d.id,
        slug: typeof raw['slug'] === 'string' ? (raw['slug'] as string) : '',
        directory: inputs.directory,
      };
      if (inputs.timeline) {
        rowsInputs.timeline = inputs.timeline;
      }

      const rows = await buildProjectionRows(rowsInputs, entityTimestamp(raw));
      const ops = this.opsForRows(universeId, kind, d.id, rows);
      const result = await this.applyOps(batch, opCount, ops);
      if (result.committed) {
        // The mid-loop commit drained `pendingForBatch`'s entries — fire
        // their invalidation events now that readers will see fresh rows.
        publish(pendingForBatch);
        pendingForBatch = [];
      }
      batch = result.batch;
      opCount = result.opCount;
      pendingForBatch.push(d.id);
      this.bumpProcessed();
    }
    if (opCount > 0) await batch.commit();
    publish(pendingForBatch);

    return { canonicalIds };
  }

  private opsForRows(
    universeId: string,
    kind: EntityKind,
    id: string,
    rows: Awaited<ReturnType<typeof buildProjectionRows>>,
  ): Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> {
    const out: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [
      {
        ref: doc(this.firebase.firestore, 'universes', universeId, DIRECTORY, entityRowKey(kind, id)),
        data: rows.directoryRow,
      },
    ];
    if (rows.timelineRow) {
      out.push({
        ref: doc(this.firebase.firestore, 'universes', universeId, TIMELINE, entityRowKey(kind, id)),
        data: rows.timelineRow,
      });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Orphan sweep
  // -------------------------------------------------------------------------

  private async sweepOrphans(
    universeId: string,
    kind: EntityKind,
    walk: WalkResult,
  ): Promise<void> {
    const fs = this.firebase.firestore;
    const refs: ReturnType<typeof doc>[] = [];

    // Directory orphans
    const dirSnap = await getDocs(
      query(collection(fs, 'universes', universeId, DIRECTORY), where('kind', '==', kind)),
    );
    for (const d of dirSnap.docs) {
      const data = d.data() as { entityId?: string };
      if (!data.entityId || !walk.canonicalIds.has(data.entityId)) {
        refs.push(doc(fs, 'universes', universeId, DIRECTORY, d.id));
      }
    }

    if (TIMELINE_KINDS.has(kind)) {
      // Timeline orphans
      const tSnap = await getDocs(
        query(collection(fs, 'universes', universeId, TIMELINE), where('kind', '==', kind)),
      );
      for (const d of tSnap.docs) {
        const data = d.data() as { entityId?: string };
        if (!data.entityId || !walk.canonicalIds.has(data.entityId)) {
          refs.push(doc(fs, 'universes', universeId, TIMELINE, d.id));
        }
      }
    }

    // Slug-index orphans (prefix scan: doc IDs are `{kind}_{slug}`)
    const slugStart = `${kind}_`;
    // `￿` sorts after every realistic slug character, bounding the range.
    const slugEnd = `${kind}_￿`;
    const sSnap = await getDocs(
      query(
        collection(fs, 'universes', universeId, SLUG_INDEX),
        where(documentId(), '>=', slugStart),
        where(documentId(), '<', slugEnd),
      ),
    );
    for (const d of sSnap.docs) {
      const data = d.data() as { entityId?: string };
      if (!data.entityId || !walk.canonicalIds.has(data.entityId)) {
        refs.push(doc(fs, 'universes', universeId, SLUG_INDEX, d.id));
      }
    }

    if (refs.length === 0) return;

    let batch = writeBatch(fs);
    let opCount = 0;
    for (const ref of refs) {
      if (opCount >= BATCH_OP_LIMIT) {
        await batch.commit();
        batch = writeBatch(fs);
        opCount = 0;
      }
      batch.delete(ref);
      opCount++;
    }
    if (opCount > 0) await batch.commit();
  }

  // -------------------------------------------------------------------------
  // Plumbing
  // -------------------------------------------------------------------------

  private async applyOps(
    batch: ReturnType<typeof writeBatch>,
    opCount: number,
    ops: ReadonlyArray<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }>,
  ): Promise<{
    batch: ReturnType<typeof writeBatch>;
    opCount: number;
    /** True when the incoming `batch` overflowed and we flushed it. */
    committed: boolean;
  }> {
    let committed = false;
    if (opCount + ops.length > BATCH_OP_LIMIT) {
      await batch.commit();
      batch = writeBatch(this.firebase.firestore);
      opCount = 0;
      committed = true;
    }
    for (const { ref, data } of ops) {
      batch.set(ref, data);
      opCount++;
    }
    return { batch, opCount, committed };
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this._progress.set({ phase: 'starting', processed: 0, total: 0 });
    try {
      this._progress.update((p) => ({ ...p, phase: 'processing' }));
      await fn();
      this._progress.update((p) => ({ ...p, phase: 'done' }));
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      this._progress.update((p) => ({ ...p, phase: 'error', error: message }));
      throw err;
    }
  }

  private bumpTotal(n: number): void {
    this._progress.update((p) => ({ ...p, total: p.total + n }));
  }

  private bumpProcessed(): void {
    this._progress.update((p) => ({ ...p, processed: p.processed + 1 }));
  }

  private calendarContext(): CalendarProjectionContext {
    return {
      eraOrdinalLookup: this.calendar.eraOrdinalLookup,
      eraNameLookup: this.calendar.eraNameLookup,
      monthNameLookup: this.calendar.monthNameLookup,
      weekdayLookup: this.calendar.weekdayLookup,
    };
  }

  private codexContext(): CodexCategoriesProjectionContext {
    const map = new Map<string, string>();
    for (const c of this.categoriesService.categories()) {
      if (c.key) map.set(c.key, c.label);
    }
    return { categoryLabelByKey: map };
  }
}

interface FsDoc {
  id: string;
  data: () => Record<string, unknown>;
}

function entityTimestamp(entity: Record<string, unknown>): number {
  const updatedAt = entity['updatedAt'];
  if (typeof updatedAt === 'number') return updatedAt;
  const createdAt = entity['createdAt'];
  if (typeof createdAt === 'number') return createdAt;
  return Date.now();
}
