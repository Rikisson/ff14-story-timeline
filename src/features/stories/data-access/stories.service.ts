import { effect, inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
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
  QueryDocumentSnapshot,
  runTransaction,
  setDoc,
  startAfter,
  where,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { SlugTakenError } from '@shared/models';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { StoredStory, Story } from './story.types';

const PAGE_SIZE = 25;

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
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _publishedStories = signal<Story[]>([]);
  readonly publishedStories: Signal<Story[]> = this._publishedStories.asReadonly();

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
          this._publishedStories.set([]);
          this._hasMore.set(false);
          this.cursor = null;
          this._refreshError.set(null);
          return;
        }
        this._refreshError.set(null);
        this.refreshPublished(id).catch((err) => {
          console.error('StoriesService.refreshPublished failed', err);
          this._refreshError.set(
            err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          );
        });
      });
    }
  }

  async refreshPublished(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    const seq = ++this.refreshSeq;
    if (!id) {
      this._publishedStories.set([]);
      this._hasMore.set(false);
      this.cursor = null;
      return;
    }
    const q = query(
      collection(this.firebase.firestore, 'universes', id, 'stories'),
      where('draft', '==', false),
      orderBy('publishedAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    if (seq !== this.refreshSeq) return;
    this.cursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    this._hasMore.set(snap.docs.length === PAGE_SIZE);
    this._publishedStories.set(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredStory) })),
    );
  }

  async loadMorePublished(): Promise<void> {
    const id = this.universes.activeUniverseId();
    if (!id || !this.cursor || !this._hasMore() || this._loadingMore()) return;
    this._loadingMore.set(true);
    const seq = this.refreshSeq;
    try {
      const q = query(
        collection(this.firebase.firestore, 'universes', id, 'stories'),
        where('draft', '==', false),
        orderBy('publishedAt', 'desc'),
        startAfter(this.cursor),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      if (seq !== this.refreshSeq) return;
      this.cursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : this.cursor;
      this._hasMore.set(snap.docs.length === PAGE_SIZE);
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredStory) }));
      this._publishedStories.update((curr) => [...curr, ...next]);
    } catch (err) {
      console.error('StoriesService.loadMorePublished failed', err);
      this._refreshError.set(
        err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      );
    } finally {
      this._loadingMore.set(false);
    }
  }

  async getStory(id: string): Promise<Story | undefined> {
    const universeId = this.requireUniverseId();
    const snap = await getDoc(
      doc(this.firebase.firestore, 'universes', universeId, 'stories', id),
    );
    return snap.exists() ? { id: snap.id, ...(snap.data() as StoredStory) } : undefined;
  }

  async saveStory(story: Story, expectedVersion: number): Promise<number> {
    const universeId = this.requireUniverseId();
    await this.assertSlugAvailable(universeId, story.slug, story.id);
    const ref = doc(this.firebase.firestore, 'universes', universeId, 'stories', story.id);
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
    const universeId = this.requireUniverseId();
    const id = crypto.randomUUID();
    const startSceneId = crypto.randomUUID();
    const slug = await this.allocateUntitledSlug(universeId);
    const story: Story = {
      id,
      slug,
      title: 'Untitled story',
      mainCharacters: [],
      places: [],
      inGameDate: {},
      startSceneId,
      scenes: { [startSceneId]: { text: '', characters: [], position: { x: 0, y: 0 }, next: [] } },
      authorUid,
      draft: true,
      version: 1,
      updatedAt: Date.now(),
    };
    const { id: _id, ...data } = story;
    await setDoc(doc(this.firebase.firestore, 'universes', universeId, 'stories', id), data);
    return id;
  }

  private async allocateUntitledSlug(universeId: string): Promise<string> {
    const base = 'untitled-story';
    for (let i = 0; i < 1000; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const q = query(
        collection(this.firebase.firestore, 'universes', universeId, 'stories'),
        where('slug', '==', candidate),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  private async assertSlugAvailable(
    universeId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const q = query(
      collection(this.firebase.firestore, 'universes', universeId, 'stories'),
      where('slug', '==', slug),
      limit(2),
    );
    const snap = await getDocs(q);
    const taken = snap.docs.some((d) => d.id !== excludeId);
    if (taken) throw new SlugTakenError('story', slug);
  }

  async deleteStory(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteDoc(doc(this.firebase.firestore, 'universes', universeId, 'stories', id));
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
