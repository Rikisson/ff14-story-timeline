import { effect, inject, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection as fsCollection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { EntityKind, SlugTakenError } from '@shared/models';
import { FirebaseService } from '../../app/firebase/firebase.service';

const PAGE_SIZE = 50;

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

export abstract class UniverseEntityService<
  TEntity extends { id: string; slug: string },
  TDraft extends { slug: string },
> {
  protected abstract readonly collectionName: string;
  protected abstract readonly kind: EntityKind;

  protected readonly firebase = inject(FirebaseService);
  protected readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _entities = signal<TEntity[]>([]);
  protected readonly entitiesSignal: Signal<TEntity[]> = this._entities.asReadonly();

  private readonly _refreshError = signal<string | null>(null);
  readonly refreshError: Signal<string | null> = this._refreshError.asReadonly();

  private refreshSeq = 0;

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._entities.set([]);
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
      return;
    }
    const q = query(
      fsCollection(this.firebase.firestore, 'universes', id, this.collectionName),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    if (seq !== this.refreshSeq) return;
    this._entities.set(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as TEntity),
    );
  }

  async create(draft: TDraft, authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    await this.assertSlugAvailable(universeId, draft.slug);
    const id = crypto.randomUUID();
    const data = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(
      doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id),
      data,
    );
    await this.refresh(universeId);
    return id;
  }

  async update(id: string, patch: TDraft): Promise<void> {
    const universeId = this.requireUniverseId();
    await this.assertSlugAvailable(universeId, patch.slug, id);
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id),
      { ...patch, updatedAt: Date.now() },
    );
    await this.refresh(universeId);
  }

  async remove(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteDoc(
      doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id),
    );
    await this.refresh(universeId);
  }

  protected async patchFields(id: string, fields: Record<string, unknown>): Promise<void> {
    const universeId = this.requireUniverseId();
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, this.collectionName, id),
      { ...fields, updatedAt: Date.now() },
    );
    await this.refresh(universeId);
  }

  protected async assertSlugAvailable(
    universeId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const q = query(
      fsCollection(this.firebase.firestore, 'universes', universeId, this.collectionName),
      where('slug', '==', slug),
      limit(2),
    );
    const snap = await getDocs(q);
    const taken = snap.docs.some((d) => d.id !== excludeId);
    if (taken) throw new SlugTakenError(this.kind, slug);
  }

  protected requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
