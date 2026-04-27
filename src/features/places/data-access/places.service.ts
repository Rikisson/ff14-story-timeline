import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
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
} from 'firebase/firestore/lite';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { Place, PlaceDraft, StoredPlace } from './place.types';

const PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly firebase = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _places = signal<Place[]>([]);
  readonly places: Signal<Place[]> = this._places.asReadonly();

  constructor() {
    if (this.isBrowser) void this.refresh();
  }

  async refresh(): Promise<void> {
    const q = query(
      collection(this.firebase.firestore, 'places'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    this._places.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredPlace) })));
  }

  async create(draft: PlaceDraft, authorUid: string): Promise<string> {
    const id = crypto.randomUUID();
    const data: StoredPlace = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'places', id), data);
    await this.refresh();
    return id;
  }

  async update(id: string, patch: PlaceDraft): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'places', id), { ...patch });
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'places', id));
    await this.refresh();
  }
}
