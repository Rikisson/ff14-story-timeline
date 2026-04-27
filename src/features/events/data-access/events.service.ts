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
import { StoredTimelineEvent, TimelineEvent, TimelineEventDraft } from './event.types';

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly firebase = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly events: Signal<TimelineEvent[]>;

  constructor() {
    const sig = signal<TimelineEvent[]>([]);
    if (this.isBrowser) {
      const q = query(
        collection(this.firebase.firestore, 'events'),
        orderBy('createdAt', 'desc'),
      );
      onSnapshot(q, (snap) => {
        sig.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredTimelineEvent) })));
      });
    }
    this.events = sig.asReadonly();
  }

  async create(draft: TimelineEventDraft, authorUid: string): Promise<string> {
    const id = crypto.randomUUID();
    const data: StoredTimelineEvent = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'events', id), data);
    return id;
  }

  async update(id: string, patch: TimelineEventDraft): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'events', id), { ...patch });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'events', id));
  }
}
