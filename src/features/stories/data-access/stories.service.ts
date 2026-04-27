import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore/lite';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { StoredStory, Story } from './story.types';

const PAGE_SIZE = 50;

export class StaleStoryError extends Error {
  constructor(public readonly currentVersion: number, public readonly expectedVersion: number) {
    super(
      `Stale state — story has been updated elsewhere (expected v${expectedVersion}, got v${currentVersion}). Reload to see latest.`,
    );
    this.name = 'StaleStoryError';
  }
}

@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly firebase = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _publishedStories = signal<Story[]>([]);
  readonly publishedStories: Signal<Story[]> = this._publishedStories.asReadonly();

  constructor() {
    if (this.isBrowser) void this.refreshPublished();
  }

  async refreshPublished(): Promise<void> {
    const q = query(
      collection(this.firebase.firestore, 'stories'),
      where('draft', '==', false),
      orderBy('publishedAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    this._publishedStories.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredStory) })));
  }

  async getStory(id: string): Promise<Story | undefined> {
    const snap = await getDoc(doc(this.firebase.firestore, 'stories', id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as StoredStory) } : undefined;
  }

  async saveStory(story: Story, expectedVersion: number): Promise<number> {
    const ref = doc(this.firebase.firestore, 'stories', story.id);
    return runTransaction(this.firebase.firestore, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const current = (snap.data() as StoredStory).version ?? 0;
        if (current !== expectedVersion) {
          throw new StaleStoryError(current, expectedVersion);
        }
      }
      const nextVersion = expectedVersion + 1;
      const { id: _id, ...data } = story;
      tx.set(ref, { ...data, version: nextVersion, updatedAt: Date.now() });
      return nextVersion;
    });
  }

  async createDraftStory(authorUid: string): Promise<string> {
    const id = crypto.randomUUID();
    const startSceneId = crypto.randomUUID();
    const story: Story = {
      id,
      title: 'Untitled story',
      mainCharacters: [],
      places: [],
      inGameDate: '',
      startSceneId,
      scenes: { [startSceneId]: { text: '', position: { x: 0, y: 0 }, next: [] } },
      authorUid,
      draft: true,
      version: 1,
      updatedAt: Date.now(),
    };
    const { id: _id, ...data } = story;
    await setDoc(doc(this.firebase.firestore, 'stories', id), data);
    return id;
  }

  async deleteStory(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'stories', id));
  }

  async getAuthorStories(authorUid: string): Promise<Story[]> {
    const q = query(
      collection(this.firebase.firestore, 'stories'),
      where('authorUid', '==', authorUid),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredStory) }));
  }
}
