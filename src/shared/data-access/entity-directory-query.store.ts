import { computed, DestroyRef, effect, inject, signal, Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs/operators';
import { QueryDocumentSnapshot } from 'firebase/firestore/lite';
import { EntityKind } from '@shared/models';
import {
  ByKindResult,
  EntityDirectoryService,
} from './entity-directory.service';
import { ResolvedDirectoryRow } from './entity-resolver-cache.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';

export interface EntityDirectoryQueryStoreOptions {
  universeId: Signal<string | null>;
  kind: Signal<EntityKind>;
  /** Members include drafts; public reads must omit them per backend-rules. */
  includeDrafts: Signal<boolean>;
  pageSize?: number;
}

export interface EntityDirectoryQueryStore {
  rows: Signal<ResolvedDirectoryRow[]>;
  loading: Signal<boolean>;
  loadingMore: Signal<boolean>;
  error: Signal<unknown>;
  hasMore: Signal<boolean>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Per-kind directory browser store. Reads `_directory` filtered by
 * `kind`, ordered by `labelFolded`, paginated by cursor. Backs cross-kind
 * list surfaces that don't have their own per-feature service (or where
 * the existing service-side preload is being retired).
 *
 * - Reset semantics: changing `universeId`, `kind`, or `includeDrafts`
 *   resets cursor + refetches page 1.
 * - Cache invalidation: any `entity-write` for the matching kind
 *   triggers a page refetch — including off-page creates that may now
 *   match the active filter and rebuild events whose orphan sweeps
 *   removed rows. `debounceTime(100)` coalesces burst events (e.g. a
 *   chunked rebuild emitting one event per entity) so a single refetch
 *   lands after the burst settles.
 *
 * Must be created in an injection context.
 */
export function createEntityDirectoryQueryStore(
  opts: EntityDirectoryQueryStoreOptions,
): EntityDirectoryQueryStore {
  const directory = inject(EntityDirectoryService);
  const bus = inject(CacheInvalidationBus);
  const destroyRef = inject(DestroyRef);

  const pageSize = opts.pageSize ?? 25;

  const rows = signal<ResolvedDirectoryRow[]>([]);
  const cursor = signal<QueryDocumentSnapshot | null>(null);
  const hasMore = signal<boolean>(false);
  const loading = signal<boolean>(false);
  const loadingMore = signal<boolean>(false);
  const error = signal<unknown>(null);

  let refreshSeq = 0;

  const resetKey = computed(() => {
    const u = opts.universeId() ?? '';
    const k = opts.kind();
    const d = opts.includeDrafts() ? '1' : '0';
    return [u, k, d].join('::');
  });

  const refresh = async (): Promise<void> => {
    const universeId = opts.universeId();
    const seq = ++refreshSeq;
    cursor.set(null);
    rows.set([]);
    hasMore.set(false);
    error.set(null);
    if (!universeId) return;
    loading.set(true);
    try {
      const result: ByKindResult = await directory.byKind({
        universeId,
        kind: opts.kind(),
        includeDrafts: opts.includeDrafts(),
        limit: pageSize,
      });
      if (seq !== refreshSeq) return;
      rows.set(result.rows);
      cursor.set(result.nextCursor);
      hasMore.set(result.nextCursor !== null);
    } catch (err) {
      if (seq !== refreshSeq) return;
      error.set(err);
    } finally {
      if (seq === refreshSeq) loading.set(false);
    }
  };

  const loadMore = async (): Promise<void> => {
    const universeId = opts.universeId();
    if (!universeId || !hasMore() || loadingMore() || loading()) return;
    const c = cursor();
    if (!c) return;
    const seq = refreshSeq;
    loadingMore.set(true);
    try {
      const result = await directory.byKind({
        universeId,
        kind: opts.kind(),
        includeDrafts: opts.includeDrafts(),
        limit: pageSize,
        cursor: c,
      });
      if (seq !== refreshSeq) return;
      rows.update((current) => [...current, ...result.rows]);
      cursor.set(result.nextCursor);
      hasMore.set(result.nextCursor !== null);
    } catch (err) {
      if (seq !== refreshSeq) return;
      error.set(err);
    } finally {
      if (seq === refreshSeq) loadingMore.set(false);
    }
  };

  effect(() => {
    resetKey();
    void refresh();
  });

  bus.entityWrites$
    .pipe(
      filter(({ universeId, kind }) =>
        universeId === opts.universeId() && kind === opts.kind(),
      ),
      debounceTime(100),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe(() => {
      void refresh();
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
