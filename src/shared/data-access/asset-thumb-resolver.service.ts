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
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../app/firebase/firebase.service';
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

const ASSETS_COLLECTION = '_assets';
const FIRESTORE_IN_CHUNK = 30;

/**
 * Session-scoped, by-ID asset hydration for list / timeline / picker /
 * resolver-chip surfaces. Per `docs/backend-rules.md` *Asset references*:
 * caches by `(universeId, assetId)` for the session and batches misses
 * into `in` queries capped at 30 IDs.
 *
 * Consumers call `resolve(assetId)` for single thumbs (one cover per
 * card) and `resolveMany(idsSignal)` for picker / list bodies that
 * render N rows at once. Both return signals; missing or not-yet-fetched
 * IDs read `null` and can drive a skeleton placeholder. Once the batched
 * fetch lands, the signal updates and the consumer fades in the thumb.
 *
 * Cache invalidation flows through `CacheInvalidationBus`: an
 * `asset-write` event re-queues the asset for fetch and the signal
 * updates in place. Asset URLs are immutable per asset ID, so this only
 * matters for deletes and metadata edits.
 */
@Injectable({ providedIn: 'root' })
export class AssetThumbResolver {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly bus = inject(CacheInvalidationBus);

  private readonly cache = new Map<string, WritableSignal<AssetThumb | null>>();
  private readonly pendingQueue: Array<{ universeId: string; assetId: string }> = [];
  private flushScheduled = false;
  private readonly nullSignal: Signal<AssetThumb | null> = signal<AssetThumb | null>(null).asReadonly();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.bus.assetWrites$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ universeId, assetId }) => {
        const key = cacheKey(universeId, assetId);
        if (!this.cache.has(key)) return;
        this.pendingQueue.push({ universeId, assetId });
        this.scheduleFlush();
      });
  }

  resolve(assetId: string | undefined | null): Signal<AssetThumb | null> {
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

  private signalFor(universeId: string, assetId: string): Signal<AssetThumb | null> {
    const key = cacheKey(universeId, assetId);
    const existing = this.cache.get(key);
    if (existing) return existing.asReadonly();
    const sig = signal<AssetThumb | null>(null);
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
        const fetched = await this.fetchChunk(universeId, chunk);
        for (const id of chunk) {
          const sig = this.cache.get(cacheKey(universeId, id));
          if (sig) sig.set(fetched.get(id) ?? null);
        }
      }
    }
  }

  private async fetchChunk(
    universeId: string,
    assetIds: string[],
  ): Promise<Map<string, AssetThumb>> {
    const out = new Map<string, AssetThumb>();
    const q = query(
      collection(this.firebase.firestore, 'universes', universeId, ASSETS_COLLECTION),
      where(documentId(), 'in', assetIds),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as {
        url: string;
        thumbUrl?: string;
        blurDataUrl?: string;
        label?: string;
      };
      out.set(d.id, {
        id: d.id,
        url: data.url,
        thumbUrl: data.thumbUrl,
        blurDataUrl: data.blurDataUrl,
        label: data.label,
      });
    }
    return out;
  }
}

function cacheKey(universeId: string, assetId: string): string {
  return `${universeId}:${assetId}`;
}
