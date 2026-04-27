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
import { StoredTimelineEvent, TimelineEvent, TimelineEventDraft } from './event.types';

const PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly firebase = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _events = signal<TimelineEvent[]>([]);
  readonly events: Signal<TimelineEvent[]> = this._events.asReadonly();

  constructor() {
    if (this.isBrowser) void this.refresh();
  }

  async refresh(): Promise<void> {
    const q = query(
      collection(this.firebase.firestore, 'events'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    this._events.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredTimelineEvent) })));
  }

  async create(draft: TimelineEventDraft, authorUid: string): Promise<string> {
    const id = crypto.randomUUID();
    const data: StoredTimelineEvent = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'events', id), data);
    await this.refresh();
    return id;
  }

  async update(id: string, patch: TimelineEventDraft): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'events', id), { ...patch });
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'events', id));
    await this.refresh();
  }
}
