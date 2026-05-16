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
import { EntityKind, EntityRef } from '@shared/models';
import { FirebaseService } from '../../app/firebase/firebase.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';

/**
 * Subset of the `_directory` projection consumers read off resolver
 * chips, picker results, inline-ref hover cards, and detail-row
 * rendering. Mirrors the fields in `docs/backend-rules.md` *Directory
 * projection* with `sourceFingerprint` / `labelFolded` / `updatedAt`
 * stripped — the cache doesn't surface those.
 */
export interface ResolvedDirectoryRow {
  kind: EntityKind;
  id: string;
  label: string;
  slug: string;
  coverAssetId?: string;
  secondary?: string;
  categoryKey?: string;
  status?: string;
  draft?: boolean;
}

const DIRECTORY_COLLECTION = '_directory';
const FIRESTORE_IN_CHUNK = 30;

/**
 * Session-scoped, by-ID directory hydration for inline-ref tokens and
 * picker-chip rendering. Per `docs/backend-rules.md` *Inline-ref
 * resolution*: a scene with N `${kind:guid}` tokens hydrates through
 * this shared cache rather than firing N `getDoc` calls. Misses are
 * collected via microtask and fanned out in chunks of 30 across a
 * single `_directory` `in` query (the row IDs encode both `kind` and
 * `id`, so one query type covers all kinds).
 *
 * Cache invalidation: an `entity-write` event on the bus re-queues
 * that (universeId, kind, id) for fetch so chip labels refresh after
 * a rename without a page reload.
 */
@Injectable({ providedIn: 'root' })
export class EntityResolverCache {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly bus = inject(CacheInvalidationBus);

  private readonly cache = new Map<string, WritableSignal<ResolvedDirectoryRow | null>>();
  private readonly pendingQueue: Array<{ universeId: string; ref: EntityRef }> = [];
  private flushScheduled = false;
  private readonly nullSignal: Signal<ResolvedDirectoryRow | null> =
    signal<ResolvedDirectoryRow | null>(null).asReadonly();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.bus.entityWrites$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ universeId, kind, id }) => {
        const key = cacheKey(universeId, kind, id);
        if (!this.cache.has(key)) return;
        this.pendingQueue.push({ universeId, ref: { kind, id } });
        this.scheduleFlush();
      });
  }

  resolve(ref: EntityRef | null | undefined): Signal<ResolvedDirectoryRow | null> {
    if (!ref) return this.nullSignal;
    const universeId = this.universes.activeUniverseId();
    if (!universeId) return this.nullSignal;
    return this.signalFor(universeId, ref);
  }

  resolveMany(refsSignal: Signal<readonly EntityRef[]>): Signal<Map<string, ResolvedDirectoryRow>> {
    return computed(() => {
      const refs = refsSignal();
      const out = new Map<string, ResolvedDirectoryRow>();
      for (const ref of refs) {
        if (!ref?.id) continue;
        const row = this.resolve(ref)();
        if (row) out.set(`${ref.kind}:${ref.id}`, row);
      }
      return out;
    });
  }

  private signalFor(
    universeId: string,
    ref: EntityRef,
  ): Signal<ResolvedDirectoryRow | null> {
    const key = cacheKey(universeId, ref.kind, ref.id);
    const existing = this.cache.get(key);
    if (existing) return existing.asReadonly();
    const sig = signal<ResolvedDirectoryRow | null>(null);
    this.cache.set(key, sig);
    this.pendingQueue.push({ universeId, ref });
    this.scheduleFlush();
    return sig.asReadonly();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      this.flushPending().catch((err) => {
        console.error('EntityResolverCache flush failed', err);
      });
    });
  }

  private async flushPending(): Promise<void> {
    if (this.pendingQueue.length === 0) return;
    const batch = this.pendingQueue.splice(0);
    const byUniverse = new Map<string, Map<string, EntityRef>>();
    for (const { universeId, ref } of batch) {
      const inner = byUniverse.get(universeId) ?? new Map<string, EntityRef>();
      inner.set(rowKey(ref.kind, ref.id), ref);
      byUniverse.set(universeId, inner);
    }
    for (const [universeId, refsByKey] of byUniverse) {
      const allRowKeys = [...refsByKey.keys()];
      for (let i = 0; i < allRowKeys.length; i += FIRESTORE_IN_CHUNK) {
        const chunk = allRowKeys.slice(i, i + FIRESTORE_IN_CHUNK);
        const fetched = await this.fetchChunk(universeId, chunk);
        for (const rk of chunk) {
          const ref = refsByKey.get(rk)!;
          const sig = this.cache.get(cacheKey(universeId, ref.kind, ref.id));
          if (sig) sig.set(fetched.get(rk) ?? null);
        }
      }
    }
  }

  private async fetchChunk(
    universeId: string,
    rowKeys: string[],
  ): Promise<Map<string, ResolvedDirectoryRow>> {
    const out = new Map<string, ResolvedDirectoryRow>();
    const q = query(
      collection(this.firebase.firestore, 'universes', universeId, DIRECTORY_COLLECTION),
      where(documentId(), 'in', rowKeys),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as {
        kind: EntityKind;
        entityId: string;
        label: string;
        slug: string;
        coverAssetId?: string;
        secondary?: string;
        categoryKey?: string;
        status?: string;
        draft?: boolean;
      };
      out.set(d.id, {
        kind: data.kind,
        id: data.entityId,
        label: data.label,
        slug: data.slug,
        coverAssetId: data.coverAssetId,
        secondary: data.secondary,
        categoryKey: data.categoryKey,
        status: data.status,
        draft: data.draft,
      });
    }
    return out;
  }
}

function cacheKey(universeId: string, kind: EntityKind, id: string): string {
  return `${universeId}:${kind}:${id}`;
}

function rowKey(kind: EntityKind, id: string): string {
  return `${kind}_${id}`;
}
