import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import { CalendarService } from '@features/calendar';
import {
  buildCharacterDirectoryInputs,
} from '@features/characters';
import {
  buildCodexEntryDirectoryInputs,
  CodexCategoriesProjectionContext,
  CodexCategoriesService,
} from '@features/codex';
import {
  buildEventDirectoryInputs,
  buildEventTimelineInputs,
  CalendarProjectionContext,
} from '@features/events';
import { buildPlaceDirectoryInputs } from '@features/places';
import { buildPlotlineDirectoryInputs } from '@features/plotlines';
import {
  buildStoryDirectoryInputs,
  buildStoryTimelineInputs,
} from '@features/stories';
import { EntityKind } from '@shared/models';
import { FirebaseService } from '../../app/firebase/firebase.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';
import {
  buildProjectionRows,
  directoryRowKey,
  timelineRowKey,
} from './projection-rows';

/**
 * Client-side chunked projection rebuild. Per `docs/backend-rules.md`
 * *Write discipline*: three lifecycle transitions trigger a scoped
 * rebuild that doesn't fit in a single transaction:
 *
 *   - **Calendar config change** invalidates every story / event's
 *     `dateSortKey`. Call `rebuildForCalendarChange(universeId)` from
 *     the calendar settings save flow — the save modal blocks behind
 *     this until the rebuild completes.
 *   - **Category rename** dirties every codex directory row whose
 *     `categoryKey` matches. Call `rebuildForCategoryRename(universeId,
 *     categoryKey)` from the categories settings flow; the UI shows
 *     a toast with progress.
 *   - **Ad-hoc recovery** after schema changes / out-of-band edits.
 *     `rebuildKind(universeId, kind)` walks a single kind end-to-end.
 *
 * Writes are chunked via `writeBatch` (≤450 ops to leave headroom for
 * one entity's full fan-out under the 500-op cap). The rebuild is
 * idempotent — each row's fingerprint is derived from current canonical
 * state, not from prior projection state — so retrying after partial
 * failure converges on the correct result.
 *
 * Publishes `entity-write` events on the `CacheInvalidationBus` as
 * rows update so subscribed resolver caches refresh in place.
 *
 * Row construction uses the shared pure builders in `./projection-rows`
 * + the per-kind `build*DirectoryInputs` / `build*TimelineInputs`
 * modules — the same code the live write path uses, so rebuilt rows
 * carry identical fingerprints to a fresh write.
 */

const BATCH_OP_LIMIT = 450;
const DIRECTORY = '_directory';
const TIMELINE = '_timelineEntries';
const LANE = '_timelineLaneEntries';

const KIND_TO_COLLECTION: Record<EntityKind, string> = {
  character: 'characters',
  place: 'places',
  event: 'events',
  story: 'stories',
  plotline: 'plotlines',
  codexEntry: 'codexEntries',
};

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

  /**
   * Rebuild every story + event in the universe. Used by the calendar
   * settings save flow — calendar config changes invalidate
   * `dateSortKey` on every timeline row.
   */
  async rebuildForCalendarChange(universeId: string): Promise<void> {
    return this.run(async () => {
      await this.calendar.refresh(universeId);
      await this.rebuildKindInternal(universeId, 'event');
      await this.rebuildKindInternal(universeId, 'story');
    });
  }

  /**
   * Rebuild every codex entry whose `categoryKey` matches the given
   * key. Used by the categories settings rename flow — a label change
   * propagates to the directory projection's denormalised `secondary`.
   */
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
      await this.processCodexBatch(universeId, snap.docs, ctx);
    });
  }

  /**
   * Walks every canonical doc of one kind and rewrites its projection
   * rows. Used for ad-hoc recovery after schema changes or out-of-band
   * edits; the CLI script does the same thing against a deploy context.
   */
  async rebuildKind(universeId: string, kind: EntityKind): Promise<void> {
    return this.run(async () => {
      if (kind === 'event' || kind === 'story') {
        await this.calendar.refresh(universeId);
      }
      if (kind === 'codexEntry') {
        await this.categoriesService.refresh(universeId);
      }
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

    if (kind === 'event') {
      await this.processEventBatch(universeId, snap.docs);
    } else if (kind === 'story') {
      await this.processStoryBatch(universeId, snap.docs);
    } else if (kind === 'codexEntry') {
      await this.processCodexBatch(universeId, snap.docs, this.codexContext());
    } else if (kind === 'plotline') {
      await this.processSimpleBatch(universeId, kind, snap.docs, (e) => ({
        directory: buildPlotlineDirectoryInputs(e as never),
      }));
    } else if (kind === 'character') {
      await this.processSimpleBatch(universeId, kind, snap.docs, (e) => ({
        directory: buildCharacterDirectoryInputs(e as never),
      }));
    } else if (kind === 'place') {
      await this.processSimpleBatch(universeId, kind, snap.docs, (e) => ({
        directory: buildPlaceDirectoryInputs(e as never),
      }));
    }
  }

  // -------------------------------------------------------------------------
  // Per-kind batching loops. Each pulls the canonical docs, builds rows via
  // the shared pure builders, and flushes to `writeBatch` chunks of
  // BATCH_OP_LIMIT ops.
  // -------------------------------------------------------------------------

  private async processSimpleBatch(
    universeId: string,
    kind: EntityKind,
    docs: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>,
    buildInputs: (entity: Record<string, unknown> & { id: string }) => {
      directory: import('./projection-rows').DirectoryRowInputs;
    },
  ): Promise<void> {
    let batch = writeBatch(this.firebase.firestore);
    let opCount = 0;
    for (const d of docs) {
      const raw = d.data();
      const entity = { id: d.id, ...raw };
      const inputs = buildInputs(entity);
      const rows = await buildProjectionRows(
        {
          kind,
          id: d.id,
          slug: typeof raw['slug'] === 'string' ? (raw['slug'] as string) : '',
          directory: inputs.directory,
        },
        entitytimestamp(raw),
      );
      const ops = [
        { ref: doc(this.firebase.firestore, 'universes', universeId, DIRECTORY, directoryRowKey(kind, d.id)), data: rows.directoryRow },
      ];
      ({ batch, opCount } = await this.applyOps(universeId, batch, opCount, ops));
      this.bumpProcessed();
      this.bus.publishEntityWrite({ universeId, kind, id: d.id });
    }
    if (opCount > 0) await batch.commit();
  }

  private async processEventBatch(
    universeId: string,
    docs: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>,
  ): Promise<void> {
    const ctx = this.calendarContext();
    let batch = writeBatch(this.firebase.firestore);
    let opCount = 0;
    for (const d of docs) {
      const entity = { id: d.id, ...d.data() } as never;
      const rows = await buildProjectionRows(
        {
          kind: 'event',
          id: d.id,
          slug: String((d.data() as Record<string, unknown>)['slug'] ?? ''),
          directory: buildEventDirectoryInputs(entity, ctx),
          timeline: buildEventTimelineInputs(entity, ctx),
        },
        entitytimestamp(d.data()),
      );
      const ops = this.timelineOps(universeId, 'event', d.id, rows);
      ({ batch, opCount } = await this.applyOps(universeId, batch, opCount, ops));
      this.bumpProcessed();
      this.bus.publishEntityWrite({ universeId, kind: 'event', id: d.id });
    }
    if (opCount > 0) await batch.commit();
  }

  private async processStoryBatch(
    universeId: string,
    docs: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>,
  ): Promise<void> {
    const ctx = this.calendarContext();
    let batch = writeBatch(this.firebase.firestore);
    let opCount = 0;
    for (const d of docs) {
      const entity = { id: d.id, ...d.data() } as never;
      const rows = await buildProjectionRows(
        {
          kind: 'story',
          id: d.id,
          slug: String((d.data() as Record<string, unknown>)['slug'] ?? ''),
          directory: buildStoryDirectoryInputs(entity, ctx),
          timeline: buildStoryTimelineInputs(entity, ctx),
        },
        entitytimestamp(d.data()),
      );
      const ops = this.timelineOps(universeId, 'story', d.id, rows);
      ({ batch, opCount } = await this.applyOps(universeId, batch, opCount, ops));
      this.bumpProcessed();
      this.bus.publishEntityWrite({ universeId, kind: 'story', id: d.id });
    }
    if (opCount > 0) await batch.commit();
  }

  private async processCodexBatch(
    universeId: string,
    docs: ReadonlyArray<{ id: string; data: () => Record<string, unknown> }>,
    ctx: CodexCategoriesProjectionContext,
  ): Promise<void> {
    let batch = writeBatch(this.firebase.firestore);
    let opCount = 0;
    for (const d of docs) {
      const entity = { id: d.id, ...d.data() } as never;
      const rows = await buildProjectionRows(
        {
          kind: 'codexEntry',
          id: d.id,
          slug: String((d.data() as Record<string, unknown>)['slug'] ?? ''),
          directory: buildCodexEntryDirectoryInputs(entity, ctx),
        },
        entitytimestamp(d.data()),
      );
      const ops = [
        {
          ref: doc(this.firebase.firestore, 'universes', universeId, DIRECTORY, directoryRowKey('codexEntry', d.id)),
          data: rows.directoryRow,
        },
      ];
      ({ batch, opCount } = await this.applyOps(universeId, batch, opCount, ops));
      this.bumpProcessed();
      this.bus.publishEntityWrite({ universeId, kind: 'codexEntry', id: d.id });
    }
    if (opCount > 0) await batch.commit();
  }

  private timelineOps(
    universeId: string,
    kind: EntityKind,
    id: string,
    rows: Awaited<ReturnType<typeof buildProjectionRows>>,
  ): Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> {
    const out: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [
      {
        ref: doc(this.firebase.firestore, 'universes', universeId, DIRECTORY, directoryRowKey(kind, id)),
        data: rows.directoryRow,
      },
    ];
    if (rows.timelineRow) {
      out.push({
        ref: doc(this.firebase.firestore, 'universes', universeId, TIMELINE, timelineRowKey(kind, id)),
        data: rows.timelineRow,
      });
      for (const lane of rows.laneRows) {
        out.push({
          ref: doc(this.firebase.firestore, 'universes', universeId, LANE, lane.rowKey),
          data: lane.row,
        });
      }
    }
    return out;
  }

  private async applyOps(
    _universeId: string,
    batch: ReturnType<typeof writeBatch>,
    opCount: number,
    ops: ReadonlyArray<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }>,
  ): Promise<{ batch: ReturnType<typeof writeBatch>; opCount: number }> {
    if (opCount + ops.length > BATCH_OP_LIMIT) {
      await batch.commit();
      batch = writeBatch(this.firebase.firestore);
      opCount = 0;
    }
    for (const { ref, data } of ops) {
      batch.set(ref, data);
      opCount++;
    }
    return { batch, opCount };
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

function entitytimestamp(entity: Record<string, unknown>): number {
  const updatedAt = entity['updatedAt'];
  if (typeof updatedAt === 'number') return updatedAt;
  const createdAt = entity['createdAt'];
  if (typeof createdAt === 'number') return createdAt;
  return Date.now();
}

// Re-export so the public types are reachable without importing the
// concrete service module.
export type { Firestore };
