import { inject } from '@angular/core';
import {
  collection as fsCollection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { EntityKind } from '@shared/models';
import { retryOnTransient } from '@shared/utils';
import { FirebaseService } from '../../app/firebase/firebase.service';
import { CacheInvalidationBus } from './cache-invalidation.bus';
import {
  DirectoryRowInputs,
  TimelineRowInputs,
  deleteEntityWithProjections,
  writeEntityWithProjections,
} from './with-entity-projections';

const FIRESTORE_IN_CHUNK = 30;

/**
 * Write-side helper for per-kind canonical entities. Reads happen
 * through the directory projection (`EntityDirectoryQueryStore` for
 * lists, `EntityResolverCache` for chip / inline-ref hydration) or
 * through the by-id fetches below for detail surfaces.
 *
 * Per `docs/backend-rules.md` *Realtime listeners* and *Query
 * architecture*: this service does not preload the canonical
 * collection or expose a universe-wide signal. Writes still fan out
 * through `writeEntityWithProjections` so directory / timeline rows
 * stay current and the cache-invalidation bus notifies session caches.
 */
export abstract class UniverseEntityService<
  TEntity extends { id: string; slug: string },
  TDraft extends { slug: string },
> {
  protected abstract readonly collectionName: string;
  protected abstract readonly kind: EntityKind;

  /**
   * Build the directory projection inputs from a fully-hydrated canonical
   * entity. Called inside the write path after `create` merges the draft
   * with `authorUid`/`createdAt`/`id`, and after `update` merges the
   * incoming patch with the existing canonical doc.
   */
  protected abstract toDirectoryInputs(entity: TEntity): DirectoryRowInputs;

  /**
   * Optional: only kinds that participate in the timeline (story, event)
   * override this. Returning `undefined` skips the timeline + lane writes.
   */
  protected toTimelineInputs(_entity: TEntity): TimelineRowInputs | undefined {
    return undefined;
  }

  protected readonly firebase = inject(FirebaseService);
  protected readonly universes = inject(UniverseStore);
  private readonly bus = inject(CacheInvalidationBus);

  async create(draft: TDraft, authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    const id = crypto.randomUUID();
    const patch = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    } as unknown as Record<string, unknown>;
    await writeEntityWithProjections(this.firebase.firestore, {
      universeId,
      kind: this.kind,
      id,
      canonicalCollection: this.collectionName,
      patch,
      slug: draft.slug,
      buildInputs: (merged) => this.buildInputsFor(merged),
    });
    this.bus.publishEntityWrite({ universeId, kind: this.kind, id });
    return id;
  }

  async update(id: string, patch: TDraft): Promise<void> {
    const universeId = this.requireUniverseId();
    await writeEntityWithProjections(this.firebase.firestore, {
      universeId,
      kind: this.kind,
      id,
      canonicalCollection: this.collectionName,
      patch: { ...patch, updatedAt: Date.now() } as unknown as Record<string, unknown>,
      slug: patch.slug,
      buildInputs: (merged) => this.buildInputsFor(merged),
    });
    this.bus.publishEntityWrite({ universeId, kind: this.kind, id });
  }

  async remove(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteEntityWithProjections(this.firebase.firestore, {
      universeId,
      kind: this.kind,
      id,
      canonicalCollection: this.collectionName,
    });
    this.bus.publishEntityWrite({ universeId, kind: this.kind, id });
  }

  /**
   * Single canonical fetch by ID. Used by detail surfaces that consume a
   * full entity (forms, hover popovers, the player's character-sprite
   * lookup) — directory projection only carries the list-pane subset.
   */
  async getById(id: string): Promise<TEntity | null> {
    const universeId = this.requireUniverseId();
    const ref = doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id);
    const snap = await retryOnTransient(() => getDoc(ref));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as unknown as TEntity;
  }

  /**
   * Batched canonical fetch by ID. Chunks at the Firestore `in`-query
   * cap (30) per `docs/backend-rules.md` *Inline-ref resolution*. Used
   * by the player and editor to read fields the directory projection
   * doesn't carry (sprite arrays, plotline color, etc.) without
   * preloading the whole canonical collection.
   */
  async getByIds(ids: readonly string[]): Promise<Map<string, TEntity>> {
    const out = new Map<string, TEntity>();
    if (ids.length === 0) return out;
    const universeId = this.requireUniverseId();
    const unique = Array.from(new Set(ids));
    for (let i = 0; i < unique.length; i += FIRESTORE_IN_CHUNK) {
      const chunk = unique.slice(i, i + FIRESTORE_IN_CHUNK);
      const q = query(
        fsCollection(this.firebase.firestore, 'universes', universeId, this.collectionName),
        where(documentId(), 'in', chunk),
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        out.set(d.id, { id: d.id, ...d.data() } as unknown as TEntity);
      }
    }
    return out;
  }

  /**
   * Escape hatch for kinds that need to patch a *non-projected* field on
   * the canonical doc without rewriting the full entity (e.g. Character
   * sprite IDs). MUST NOT be used for any field that appears in the
   * directory or timeline projection — those rows would silently go stale.
   * Use `update` for projected-field changes.
   *
   * Still publishes on the cache-invalidation bus so listeners that cache
   * the canonical doc (e.g. an entity list controller's selected entity)
   * can refetch.
   */
  protected async patchFields(id: string, fields: Record<string, unknown>): Promise<void> {
    const universeId = this.requireUniverseId();
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id),
      { ...fields, updatedAt: Date.now() },
    );
    this.bus.publishEntityWrite({ universeId, kind: this.kind, id });
  }

  protected requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }

  private buildInputsFor(merged: Record<string, unknown> & { id: string }): {
    directory: DirectoryRowInputs;
    timeline?: TimelineRowInputs;
  } {
    const entity = merged as unknown as TEntity;
    const directory = this.toDirectoryInputs(entity);
    const timeline = this.toTimelineInputs(entity);
    return timeline ? { directory, timeline } : { directory };
  }
}
