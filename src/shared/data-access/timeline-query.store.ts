import { computed, DestroyRef, effect, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  collection,
  Firestore,
  getDocs,
  limit,
  orderBy,
  query,
  Query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from 'firebase/firestore/lite';
import { InGameDate } from '@shared/models';
import { FirebaseService } from '../../app/firebase/firebase.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';
import { UNASSIGNED_LANE_KEY } from './projection-rows';

const TIMELINE_COLLECTION = '_timelineEntries';
const LANE_COLLECTION = '_timelineLaneEntries';
const DEFAULT_PAGE_SIZE = 25;

/**
 * Read-only row shape consumed by timeline UIs. Mirrors the projection
 * shape written by `buildProjectionRows` in `projection-rows.ts`, minus
 * the `sourceFingerprint` (consumers don't read it) and with `kind`
 * narrowed to the timeline kinds.
 */
export interface TimelineRow {
  kind: 'story' | 'event';
  id: string;
  title: string;
  coverAssetId?: string;
  inGameDate: InGameDate;
  dateSortKey: string;
  dateKnown: boolean;
  plotlineIds: string[];
  characterIds: string[];
  placeIds: string[];
  draft: boolean;
  visiblePublic: boolean;
  /** Lane projections carry this; entity projections don't. */
  laneKey?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface TimelineQueryStoreOptions {
  universeId: Signal<string | null>;
  /** Members include drafts; public reads must omit them per backend-rules. */
  includeDrafts: Signal<boolean>;
  sortDirection: Signal<SortDirection>;
  pageSize?: number;
}

export interface TimelineLaneStoreOptions extends TimelineQueryStoreOptions {
  laneKey: Signal<string>;
}

export interface TimelineQueryStore {
  rows: Signal<TimelineRow[]>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  error: Signal<unknown>;
  hasMore: Signal<boolean>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export type TimelineLaneStore = TimelineQueryStore;

/** Sentinel used by the timeline store / caller for the "no plotlines" lane. */
export { UNASSIGNED_LANE_KEY };

/**
 * Global timeline query store: reads `_timelineEntries` ordered by
 * `dateSortKey`, paginated by cursor. Use this when no plotline lane is
 * selected. See `docs/narrative-engine-impl.md` *Timeline UX* and
 * `docs/backend-rules.md` *Timeline projections*.
 *
 * Reset semantics: changing `universeId`, `includeDrafts`, or
 * `sortDirection` resets the cursor and re-fetches page 1.
 *
 * Cache invalidation: an `entity-write` event for a row currently in the
 * page refetches the page in place; writes for off-page rows are
 * ignored — they'll surface on the next paginate naturally.
 *
 * Must be created in an injection context (component constructor). The
 * bus subscription and the reactive reset effect auto-dispose on host
 * destroy.
 */
export function createTimelineQueryStore(
  opts: TimelineQueryStoreOptions,
): TimelineQueryStore {
  return createStore({
    universeId: opts.universeId,
    includeDrafts: opts.includeDrafts,
    sortDirection: opts.sortDirection,
    pageSize: opts.pageSize,
    extraResetKey: () => '',
    buildQuery: (firestore, universeId, cursor, pageSize) => {
      const constraints: QueryConstraint[] = [];
      if (!opts.includeDrafts()) constraints.push(where('visiblePublic', '==', true));
      constraints.push(where('dateKnown', '==', true));
      constraints.push(orderBy('dateSortKey', opts.sortDirection()));
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(pageSize));
      return query(
        collection(firestore, 'universes', universeId, TIMELINE_COLLECTION),
        ...constraints,
      );
    },
  });
}

/**
 * Per-lane timeline query store: reads `_timelineLaneEntries` filtered
 * by `laneKey`. One instance per selected plotline lane (and one for
 * `__unassigned__` when the unassigned filter is on). Each lane has its
 * own cursor + load-more state per *Per-lane pagination is the default*.
 */
export function createTimelineLaneStore(
  opts: TimelineLaneStoreOptions,
): TimelineLaneStore {
  return createStore({
    universeId: opts.universeId,
    includeDrafts: opts.includeDrafts,
    sortDirection: opts.sortDirection,
    pageSize: opts.pageSize,
    extraResetKey: () => opts.laneKey(),
    buildQuery: (firestore, universeId, cursor, pageSize) => {
      const lane = opts.laneKey();
      const constraints: QueryConstraint[] = [];
      if (!opts.includeDrafts()) constraints.push(where('visiblePublic', '==', true));
      constraints.push(where('laneKey', '==', lane));
      constraints.push(where('dateKnown', '==', true));
      constraints.push(orderBy('dateSortKey', opts.sortDirection()));
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(pageSize));
      return query(
        collection(firestore, 'universes', universeId, LANE_COLLECTION),
        ...constraints,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface StoreConfig {
  universeId: Signal<string | null>;
  includeDrafts: Signal<boolean>;
  sortDirection: Signal<SortDirection>;
  pageSize?: number;
  extraResetKey: () => string;
  buildQuery: (
    firestore: Firestore,
    universeId: string,
    cursor: QueryDocumentSnapshot | null,
    pageSize: number,
  ) => Query;
}

function createStore(config: StoreConfig): TimelineQueryStore {
  const firebase = inject(FirebaseService);
  const bus = inject(CacheInvalidationBus);
  const destroyRef = inject(DestroyRef);

  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;

  const rows = signal<TimelineRow[]>([]);
  const cursor = signal<QueryDocumentSnapshot | null>(null);
  const hasMore = signal<boolean>(false);
  const loading = signal<boolean>(false);
  const loadingMore = signal<boolean>(false);
  const error = signal<unknown>(null);

  let refreshSeq = 0;

  const resetKey = computed(() => {
    const u = config.universeId() ?? '';
    const d = config.includeDrafts() ? '1' : '0';
    const s = config.sortDirection();
    const extra = config.extraResetKey();
    return [u, d, s, extra].join('::');
  });

  const refresh = async (): Promise<void> => {
    const universeId = config.universeId();
    const seq = ++refreshSeq;
    cursor.set(null);
    rows.set([]);
    hasMore.set(false);
    error.set(null);
    if (!universeId) return;
    loading.set(true);
    try {
      const q = config.buildQuery(firebase.firestore, universeId, null, pageSize);
      const snap = await getDocs(q);
      if (seq !== refreshSeq) return;
      rows.set(snap.docs.map((d) => toTimelineRow(d.data() as RawTimelineRow)));
      cursor.set(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      hasMore.set(snap.docs.length === pageSize);
    } catch (err) {
      if (seq !== refreshSeq) return;
      error.set(err);
    } finally {
      if (seq === refreshSeq) loading.set(false);
    }
  };

  const loadMore = async (): Promise<void> => {
    const universeId = config.universeId();
    if (!universeId || !hasMore() || loadingMore() || loading()) return;
    const seq = refreshSeq;
    loadingMore.set(true);
    try {
      const q = config.buildQuery(firebase.firestore, universeId, cursor(), pageSize);
      const snap = await getDocs(q);
      if (seq !== refreshSeq) return;
      const more = snap.docs.map((d) => toTimelineRow(d.data() as RawTimelineRow));
      rows.update((current) => [...current, ...more]);
      if (snap.docs.length > 0) cursor.set(snap.docs[snap.docs.length - 1]);
      hasMore.set(snap.docs.length === pageSize);
    } catch (err) {
      if (seq !== refreshSeq) return;
      error.set(err);
    } finally {
      if (seq === refreshSeq) loadingMore.set(false);
    }
  };

  // Reset + reload whenever the query shape changes. `resetKey` collapses
  // every input into one signal; this effect fires once per real change.
  effect(() => {
    resetKey();
    void refresh();
  });

  bus.entityWrites$
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(({ universeId, kind, id }) => {
      if (universeId !== config.universeId()) return;
      if (kind !== 'story' && kind !== 'event') return;
      if (rows().some((r) => r.id === id && r.kind === kind)) {
        // Row in the current page changed; refetch the page in place to
        // pick up the new projection (title, plotline membership, draft
        // flip…). Off-page writes surface naturally on the next paginate.
        void refresh();
      }
    });

  return {
    rows: rows.asReadonly(),
    loading: loading.asReadonly(),
    loadingMore: loadingMore.asReadonly(),
    error: error.asReadonly(),
    hasMore: hasMore.asReadonly(),
    refresh,
    loadMore,
  };
}

interface RawTimelineRow {
  kind: 'story' | 'event';
  entityId: string;
  title: string;
  coverAssetId?: string;
  inGameDate: InGameDate;
  dateSortKey: string;
  dateKnown: boolean;
  plotlineIds: string[];
  characterIds: string[];
  placeIds: string[];
  draft: boolean;
  visiblePublic: boolean;
  laneKey?: string;
}

function toTimelineRow(raw: RawTimelineRow): TimelineRow {
  return {
    kind: raw.kind,
    id: raw.entityId,
    title: raw.title,
    coverAssetId: raw.coverAssetId,
    inGameDate: raw.inGameDate,
    dateSortKey: raw.dateSortKey,
    dateKnown: raw.dateKnown,
    plotlineIds: raw.plotlineIds ?? [],
    characterIds: raw.characterIds ?? [],
    placeIds: raw.placeIds ?? [],
    draft: raw.draft ?? false,
    visiblePublic: raw.visiblePublic ?? false,
    laneKey: raw.laneKey,
  };
}
