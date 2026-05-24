import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UniverseStore } from '@features/universes';
import { AssetDocsFetcher } from './asset-docs-fetcher.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';

/**
 * Thin asset shape consumers need to render a card / picker thumb. Per
 * `docs/media-rules.md` *Loading*: `thumbUrl ?? url` is the rendered
 * source; `blurDataUrl` is the immediate-placeholder shown before the
 * image actually loads.
 */
export interface AssetThumb {
  id: string;
  url: string;
  thumbUrl?: string;
  blurDataUrl?: string;
  label?: string;
}

const FIRESTORE_IN_CHUNK = 30;

/**
 * Tristate resolution result. `undefined` is "fetch still in flight",
 * `null` is "fetch resolved, no doc by this ID" (deleted or never
 * existed), and an `AssetThumb` is "ready, render the URL". Consumers
 * that want a skeleton-while-pending UI distinguish `undefined` from
 * `null`; consumers that only care about "have I got something to
 * render" can keep treating both falsy values the same way.
 */
export type AssetThumbSignalValue = AssetThumb | null | undefined;

/**
 * Session-scoped, by-ID asset hydration for list / timeline / picker /
 * resolver-chip surfaces. Per `docs/backend-rules.md` *Asset references*:
 * caches by `(universeId, assetId)` for the session and batches misses
 * into `in` queries capped at 30 IDs.
 *
 * Consumers call `resolve(assetId)` for single thumbs (one cover per
 * card) and `resolveMany(idsSignal)` for picker / list bodies that
 * render N rows at once. Both return signals using the tristate above:
 * `undefined` while the batched fetch is in flight (drives a skeleton),
 * `null` once the fetch confirms the asset is missing (drives an empty
 * slot — don't keep the skeleton spinning), and an `AssetThumb` once
 * the URL is available.
 *
 * Cache invalidation flows through `CacheInvalidationBus`: an
 * `asset-write` event re-queues the asset for fetch and the signal
 * updates in place. Asset URLs are immutable per asset ID, so this only
 * matters for deletes and metadata edits.
 */
@Injectable({ providedIn: 'root' })
export class AssetThumbResolver {
  private readonly fetcher = inject(AssetDocsFetcher);
  private readonly universes = inject(UniverseStore);
  private readonly bus = inject(CacheInvalidationBus);

  private readonly cache = new Map<string, WritableSignal<AssetThumbSignalValue>>();
  private readonly pendingQueue: Array<{ universeId: string; assetId: string }> = [];
  private flushScheduled = false;
  // Sentinel signal for "no asset ID supplied" and "no active universe"
  // — these are stable resolved states (not pending) so they return
  // `null`, never `undefined`.
  private readonly nullSignal: Signal<AssetThumbSignalValue> = signal<AssetThumbSignalValue>(
    null,
  ).asReadonly();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.bus.assetWrites$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ universeId, assetId }) => {
        const key = cacheKey(universeId, assetId);
        const existing = this.cache.get(key);
        if (!existing) return;
        // Reset to pending so consumers re-render their skeleton while
        // the refetch is in flight (covers asset deletes via metadata
        // edits — URLs are immutable, but `label` can change).
        existing.set(undefined);
        this.pendingQueue.push({ universeId, assetId });
        this.scheduleFlush();
      });
  }

  resolve(assetId: string | undefined | null): Signal<AssetThumbSignalValue> {
    if (!assetId) return this.nullSignal;
    const universeId = this.universes.activeUniverseId();
    if (!universeId) return this.nullSignal;
    return this.signalFor(universeId, assetId);
  }

  resolveMany(idsSignal: Signal<readonly string[]>): Signal<Map<string, AssetThumb>> {
    return computed(() => {
      const ids = idsSignal();
      const out = new Map<string, AssetThumb>();
      for (const id of ids) {
        if (!id) continue;
        const thumb = this.resolve(id)();
        if (thumb) out.set(id, thumb);
      }
      return out;
    });
  }

  private signalFor(universeId: string, assetId: string): Signal<AssetThumbSignalValue> {
    const key = cacheKey(universeId, assetId);
    const existing = this.cache.get(key);
    if (existing) return existing.asReadonly();
    // Start at `undefined` so the first read renders the
    // pending/skeleton state until the batched fetch lands.
    const sig = signal<AssetThumbSignalValue>(undefined);
    this.cache.set(key, sig);
    this.pendingQueue.push({ universeId, assetId });
    this.scheduleFlush();
    return sig.asReadonly();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      this.flushPending().catch((err) => {
        console.error('AssetThumbResolver flush failed', err);
      });
    });
  }

  private async flushPending(): Promise<void> {
    if (this.pendingQueue.length === 0) return;
    const batch = this.pendingQueue.splice(0);
    const byUniverse = new Map<string, Set<string>>();
    for (const { universeId, assetId } of batch) {
      const set = byUniverse.get(universeId) ?? new Set<string>();
      set.add(assetId);
      byUniverse.set(universeId, set);
    }
    for (const [universeId, ids] of byUniverse) {
      const idList = [...ids];
      for (let i = 0; i < idList.length; i += FIRESTORE_IN_CHUNK) {
        const chunk = idList.slice(i, i + FIRESTORE_IN_CHUNK);
        const fetched = await this.fetcher.fetchAssets(universeId, chunk);
        for (const id of chunk) {
          const sig = this.cache.get(cacheKey(universeId, id));
          // `null` records the resolved-missing state so the consumer
          // stops showing a pending skeleton for a deleted asset.
          if (sig) sig.set(fetched.get(id) ?? null);
        }
      }
    }
  }
}

function cacheKey(universeId: string, assetId: string): string {
  return `${universeId}:${assetId}`;
}
