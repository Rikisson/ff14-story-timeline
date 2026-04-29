import { effect, inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
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
import { SlugTakenError } from '@shared/models';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { Place, PlaceDraft, StoredPlace } from './place.types';

const PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _places = signal<Place[]>([]);
  readonly places: Signal<Place[]> = this._places.asReadonly();

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._places.set([]);
          return;
        }
        void this.refresh(id);
      });
    }
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    if (!id) {
      this._places.set([]);
      return;
    }
    const q = query(
      collection(this.firebase.firestore, 'universes', id, 'places'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    this._places.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredPlace) })));
  }

  async create(draft: PlaceDraft, authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    await this.assertSlugAvailable(universeId, draft.slug);
    const id = crypto.randomUUID();
    const data: StoredPlace = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'universes', universeId, 'places', id), data);
    await this.refresh(universeId);
    return id;
  }

  async update(id: string, patch: PlaceDraft): Promise<void> {
    const universeId = this.requireUniverseId();
    await this.assertSlugAvailable(universeId, patch.slug, id);
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, 'places', id),
      { ...patch },
    );
    await this.refresh(universeId);
  }

  async remove(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteDoc(doc(this.firebase.firestore, 'universes', universeId, 'places', id));
    await this.refresh(universeId);
  }

  private async assertSlugAvailable(
    universeId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const q = query(
      collection(this.firebase.firestore, 'universes', universeId, 'places'),
      where('slug', '==', slug),
      limit(2),
    );
    const snap = await getDocs(q);
    const taken = snap.docs.some((d) => d.id !== excludeId);
    if (taken) throw new SlugTakenError('place', slug);
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
