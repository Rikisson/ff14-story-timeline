import { effect, inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  runTransaction,
  startAfter,
  where,
} from 'firebase/firestore/lite';
import { TranslocoService } from '@jsverse/transloco';
import { CalendarProjectionContext, CalendarService } from '@features/calendar';
import { UniverseStore } from '@features/universes';
import {
  applyEntityDelete,
  applyEntityWrite,
  DirectoryRowInputs,
  TimelineRowInputs,
} from '@shared/data-access';
import { retryOnTransient } from '@shared/utils';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  buildStoryDirectoryInputs,
  buildStoryTimelineInputs,
} from './story-projection';
import {
  StoredStory,
  StoredStoryContent,
  Story,
  StoryContent,
} from './story.types';

const PAGE_SIZE = 25;
const CONTENT_DOC_PATH = ['_content', 'main'] as const;
const STORY_SLUG_PREFIX = 'story_';
const UNTITLED_SLUG_BASE = 'untitled-story';
const UNTITLED_SLUG_MAX_ATTEMPTS = 1000;

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
  private readonly transloco = inject(TranslocoService);
  private readonly calendar = inject(CalendarService);
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
    const snap = await retryOnTransient(() => getDocs(q));
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
    const snap = await getDoc(this.metaDocRef(universeId, id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as StoredStory) } : undefined;
  }

  async getStoryContent(id: string): Promise<StoryContent | undefined> {
    const universeId = this.requireUniverseId();
    const snap = await getDoc(this.contentDocRef(universeId, id));
    return snap.exists() ? (snap.data() as StoredStoryContent) : undefined;
  }

  async getStoryWithContent(
    id: string,
  ): Promise<{ story: Story; content: StoryContent } | undefined> {
    const [story, content] = await Promise.all([this.getStory(id), this.getStoryContent(id)]);
    if (!story || !content) return undefined;
    return { story, content };
  }

  /**
   * Save story metadata + content in one `runTransaction`. The OCC version
   * check, the canonical metadata write, the `_directory` /
   * `_timelineEntries` / `_timelineLaneEntries` / `_slugIndex` fan-out
   * (via `applyEntityWrite`), and the `_content/main` subdoc write all
   * commit or all fail together.
   */
  async saveStory(
    story: Story,
    content: StoryContent,
    expectedVersion: number,
  ): Promise<number> {
    const universeId = this.requireUniverseId();
    const contentRef = this.contentDocRef(universeId, story.id);
    return runTransaction(this.firebase.firestore, async (tx) => {
      // Story-specific OCC check. `applyEntityWrite` will read the same
      // canonical doc later in this transaction; Firestore caches that
      // read, so there's no extra round-trip.
      const metaSnap = await tx.get(this.metaDocRef(universeId, story.id));
      if (metaSnap.exists()) {
        const current = (metaSnap.data() as StoredStory).version ?? 0;
        if (current !== expectedVersion) {
          throw new StaleStoryError(current, expectedVersion);
        }
      }
      const nextVersion = expectedVersion + 1;
      const { id: _id, ...meta } = story;
      const patch: Record<string, unknown> = {
        ...meta,
        version: nextVersion,
        updatedAt: Date.now(),
      };

      await applyEntityWrite(tx, this.firebase.firestore, {
        universeId,
        kind: 'story',
        id: story.id,
        canonicalCollection: 'stories',
        patch,
        slug: story.slug,
        buildInputs: (merged) => ({
          directory: this.buildDirectoryInputs(merged as unknown as Story),
          timeline: this.buildTimelineInputs(merged as unknown as Story),
        }),
      });

      tx.set(contentRef, content satisfies StoredStoryContent);
      return nextVersion;
    });
  }

  /**
   * Create a fresh draft. Allocates an untitled slug against `_slugIndex`,
   * then writes canonical metadata + projections + slug + content all in
   * one `runTransaction`.
   */
  async createDraftStory(authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    const id = crypto.randomUUID();
    const startSceneId = crypto.randomUUID();
    const slug = await this.allocateUntitledSlug(universeId);
    const now = Date.now();
    const metaData: StoredStory = {
      slug,
      title: this.transloco.translate('general.message.untitledStory'),
      inGameDate: {},
      authorUid,
      draft: true,
      createdAt: now,
      version: 1,
      updatedAt: now,
    };
    const contentData: StoredStoryContent = {
      startSceneId,
      scenes: {
        [startSceneId]: { text: '', characters: [], position: { x: 0, y: 0 }, next: [] },
      },
    };

    await runTransaction(this.firebase.firestore, async (tx) => {
      await applyEntityWrite(tx, this.firebase.firestore, {
        universeId,
        kind: 'story',
        id,
        canonicalCollection: 'stories',
        patch: metaData as unknown as Record<string, unknown>,
        slug,
        buildInputs: (merged) => ({
          directory: this.buildDirectoryInputs(merged as unknown as Story),
          timeline: this.buildTimelineInputs(merged as unknown as Story),
        }),
      });
      tx.set(this.contentDocRef(universeId, id), contentData);
    });
    return id;
  }

  /**
   * Delete metadata + content + projections + slug-index entry in one
   * `runTransaction`. The helper's read of canonical recovers the
   * current slug for the `_slugIndex` delete, so callers don't need to
   * track it.
   */
  async deleteStory(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    const contentRef = this.contentDocRef(universeId, id);
    await runTransaction(this.firebase.firestore, async (tx) => {
      await applyEntityDelete(tx, this.firebase.firestore, {
        universeId,
        kind: 'story',
        id,
        canonicalCollection: 'stories',
      });
      tx.delete(contentRef);
    });
  }

  private buildDirectoryInputs(story: Story): DirectoryRowInputs {
    return buildStoryDirectoryInputs(story, this.calendarContext());
  }

  private buildTimelineInputs(story: Story): TimelineRowInputs {
    return buildStoryTimelineInputs(story, this.calendarContext());
  }

  private calendarContext(): CalendarProjectionContext {
    return {
      eraOrdinalLookup: this.calendar.eraOrdinalLookup,
      eraNameLookup: this.calendar.eraNameLookup,
      monthNameLookup: this.calendar.monthNameLookup,
      weekdayLookup: this.calendar.weekdayLookup,
    };
  }

  /**
   * Walks `_slugIndex/story_<candidate>` against the new slug-index
   * collection. Same race as before: between picking a free candidate
   * and the create transaction's atomic claim, another writer might
   * grab it — in which case `applyEntityWrite` throws SlugTakenError
   * and the caller retries.
   */
  private async allocateUntitledSlug(universeId: string): Promise<string> {
    for (let i = 0; i < UNTITLED_SLUG_MAX_ATTEMPTS; i++) {
      const candidate = i === 0 ? UNTITLED_SLUG_BASE : `${UNTITLED_SLUG_BASE}-${i + 1}`;
      const slugRef = doc(
        this.firebase.firestore,
        'universes',
        universeId,
        '_slugIndex',
        `${STORY_SLUG_PREFIX}${candidate}`,
      );
      const snap = await getDoc(slugRef);
      if (!snap.exists()) return candidate;
    }
    return `${UNTITLED_SLUG_BASE}-${Date.now()}`;
  }

  private metaDocRef(universeId: string, id: string) {
    return doc(this.firebase.firestore, 'universes', universeId, 'stories', id);
  }

  private contentDocRef(universeId: string, id: string) {
    return doc(
      this.firebase.firestore,
      'universes',
      universeId,
      'stories',
      id,
      ...CONTENT_DOC_PATH,
    );
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
