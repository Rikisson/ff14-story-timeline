import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { StoredStory, Story } from './story.types';

@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly firebase = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly publishedStories: Signal<Story[]>;

  constructor() {
    const sig = signal<Story[]>([]);
    if (this.isBrowser) {
      const q = query(
        collection(this.firebase.firestore, 'stories'),
        where('draft', '==', false),
        orderBy('publishedAt', 'desc'),
      );
      onSnapshot(q, (snap) => {
        sig.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredStory) })));
      });
    }
    this.publishedStories = sig.asReadonly();
  }

  async getStory(id: string): Promise<Story | undefined> {
    const snap = await getDoc(doc(this.firebase.firestore, 'stories', id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as StoredStory) } : undefined;
  }

  async saveStory(story: Story): Promise<void> {
    const { id, ...data } = story;
    await setDoc(doc(this.firebase.firestore, 'stories', id), data);
  }

  async deleteStory(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'stories', id));
  }
}
