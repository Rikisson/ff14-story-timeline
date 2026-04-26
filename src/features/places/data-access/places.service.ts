import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { Place, PlaceDraft, StoredPlace } from './place.types';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly firebase = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly places: Signal<Place[]>;

  constructor() {
    const sig = signal<Place[]>([]);
    if (this.isBrowser) {
      const q = query(
        collection(this.firebase.firestore, 'places'),
        orderBy('createdAt', 'desc'),
      );
      onSnapshot(q, (snap) => {
        sig.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredPlace) })));
      });
    }
    this.places = sig.asReadonly();
  }

  async create(draft: PlaceDraft, authorUid: string): Promise<string> {
    const id = crypto.randomUUID();
    const data: StoredPlace = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'places', id), data);
    return id;
  }

  async update(id: string, patch: PlaceDraft): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'places', id), { ...patch });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'places', id));
  }
}
