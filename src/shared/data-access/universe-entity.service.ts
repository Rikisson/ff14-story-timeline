import { effect, inject, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection as fsCollection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  updateDoc,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { EntityKind } from '@shared/models';
import { retryOnTransient } from '@shared/utils';
import { FirebaseService } from '../../app/firebase/firebase.service';
import {
  DirectoryRowInputs,
  TimelineRowInputs,
  deleteEntityWithProjections,
  writeEntityWithProjections,
} from './with-entity-projections';

const PAGE_SIZE = 25;

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _entities = signal<TEntity[]>([]);
  protected readonly entitiesSignal: Signal<TEntity[]> = this._entities.asReadonly();

  private readonly _refreshError = signal<string | null>(null);
  readonly refreshError: Signal<string | null> = this._refreshError.asReadonly();

  private readonly _hasMore = signal(false);
  readonly hasMore: Signal<boolean> = this._hasMore.asReadonly();

  private readonly _loadingMore = signal(false);
  readonly loadingMore: Signal<boolean> = this._loadingMore.asReadonly();

  private cursor: QueryDocumentSnapshot | null = null;
  private refreshSeq = 0;

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._entities.set([]);
          this._hasMore.set(false);
          this.cursor = null;
          this._refreshError.set(null);
          return;
        }
        this._refreshError.set(null);
        this.refresh(id).catch((err) => {
          console.error(`${this.collectionName} refresh failed`, err);
          this._refreshError.set(errorMessage(err));
        });
      });
    }
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    const seq = ++this.refreshSeq;
    if (!id) {
      this._entities.set([]);
      this._hasMore.set(false);
      this.cursor = null;
      return;
    }
    const q = query(
      fsCollection(this.firebase.firestore, 'universes', id, this.collectionName),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await retryOnTransient(() => getDocs(q));
    if (seq !== this.refreshSeq) return;
    this.cursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    this._hasMore.set(snap.docs.length === PAGE_SIZE);
    this._entities.set(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as TEntity),
    );
  }

  async loadMore(): Promise<void> {
    const id = this.universes.activeUniverseId();
    if (!id || !this.cursor || !this._hasMore() || this._loadingMore()) return;
    this._loadingMore.set(true);
    const seq = this.refreshSeq;
    try {
      const q = query(
        fsCollection(this.firebase.firestore, 'universes', id, this.collectionName),
        orderBy('createdAt', 'desc'),
        startAfter(this.cursor),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      if (seq !== this.refreshSeq) return;
      this.cursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : this.cursor;
      this._hasMore.set(snap.docs.length === PAGE_SIZE);
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as TEntity);
      this._entities.update((curr) => [...curr, ...next]);
    } catch (err) {
      console.error(`${this.collectionName} loadMore failed`, err);
      this._refreshError.set(errorMessage(err));
    } finally {
      this._loadingMore.set(false);
    }
  }

  async create(draft: TDraft, authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    const id = crypto.randomUUID();
    const entity = {
      ...draft,
      id,
      authorUid,
      createdAt: Date.now(),
    } as unknown as TEntity;
    await this.writeThroughProjections(universeId, entity);
    await this.refresh(universeId);
    return id;
  }

  async update(id: string, patch: TDraft): Promise<void> {
    const universeId = this.requireUniverseId();
    const existing = await this.loadCanonical(universeId, id);
    if (!existing) {
      throw new Error(`${this.collectionName}/${id} not found`);
    }
    const entity = {
      ...existing,
      ...patch,
      id,
      updatedAt: Date.now(),
    } as unknown as TEntity;
    await this.writeThroughProjections(universeId, entity);
    await this.refresh(universeId);
  }

  async remove(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteEntityWithProjections(this.firebase.firestore, {
      universeId,
      kind: this.kind,
      id,
      canonicalCollection: this.collectionName,
    });
    await this.refresh(universeId);
  }

  /**
   * Escape hatch for kinds that need to patch a *non-projected* field on
   * the canonical doc without rewriting the full entity (e.g. Character
   * sprite IDs). MUST NOT be used for any field that appears in the
   * directory or timeline projection — those rows would silently go stale.
   * Use `update` for projected-field changes.
   */
  protected async patchFields(id: string, fields: Record<string, unknown>): Promise<void> {
    const universeId = this.requireUniverseId();
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id),
      { ...fields, updatedAt: Date.now() },
    );
    await this.refresh(universeId);
  }

  protected requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }

  private async writeThroughProjections(universeId: string, entity: TEntity): Promise<void> {
    const { id, ...canonical } = entity as unknown as { id: string } & Record<string, unknown>;
    await writeEntityWithProjections(this.firebase.firestore, {
      universeId,
      kind: this.kind,
      id,
      canonicalCollection: this.collectionName,
      canonical,
      slug: entity.slug,
      directory: this.toDirectoryInputs(entity),
      timeline: this.toTimelineInputs(entity),
    });
  }

  private async loadCanonical(universeId: string, id: string): Promise<TEntity | null> {
    const snap = await getDoc(
      doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id),
    );
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as object) } as unknown as TEntity;
  }
}
