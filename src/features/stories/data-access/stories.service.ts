import { inject, Injectable } from '@angular/core';
import {
  doc,
  getDoc,
  runTransaction,
} from 'firebase/firestore/lite';
import { TranslocoService } from '@jsverse/transloco';
import { CalendarProjectionContext, CalendarService } from '@features/calendar';
import { ConnectionsService } from '@features/connections';
import { UniverseStore } from '@features/universes';
import {
  applyEntityDelete,
  applyEntityWrite,
  CacheInvalidationBus,
  DirectoryRowInputs,
  TimelineRowInputs,
} from '@shared/data-access';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  buildStoryDirectoryInputs,
  buildStoryTimelineInputs,
} from './story-projection';
import {
  Scene,
  StoredStory,
  StoredStoryContent,
  Story,
  StoryContent,
} from './story.types';

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

/**
 * Story write helper + by-id reader. Browsing the published stories list
 * goes through `EntityDirectoryQueryStore` (kind `story`); the player
 * loads metadata + content via `getStoryWithContent`. Per
 * `docs/backend-rules.md` *Realtime listeners* and *Query architecture*
 * the service no longer preloads a universe-wide signal — every read
 * happens by ID or through the projection.
 */
@Injectable({ providedIn: 'root' })
export class StoriesService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly transloco = inject(TranslocoService);
  private readonly calendar = inject(CalendarService);
  private readonly bus = inject(CacheInvalidationBus);
  private readonly connections = inject(ConnectionsService);

  async getStory(id: string): Promise<Story | undefined> {
    const universeId = this.requireUniverseId();
    const snap = await getDoc(this.metaDocRef(universeId, id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as StoredStory) } : undefined;
  }

  async getStoryContent(id: string): Promise<StoryContent | undefined> {
    const universeId = this.requireUniverseId();
    const snap = await getDoc(this.contentDocRef(universeId, id));
    if (!snap.exists()) return undefined;
    return normalizeStoryContent(snap.data() as Record<string, unknown>);
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
   * `_timelineEntries` / `_slugIndex` fan-out
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
    const nextVersion = await runTransaction(this.firebase.firestore, async (tx) => {
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
      const next = expectedVersion + 1;
      const { id: _id, ...meta } = story;
      const patch: Record<string, unknown> = {
        ...meta,
        version: next,
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
      return next;
    });
    this.bus.publishEntityWrite({ universeId, kind: 'story', id: story.id });
    return nextVersion;
  }

  /**
   * Create a fresh draft. Allocates an untitled slug against `_slugIndex`,
   * then writes canonical metadata + projections + slug + content all in
   * one `runTransaction`.
   */
  async createDraftStory(authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    const id = crypto.randomUUID();
    const introSceneId = crypto.randomUUID();
    const contentSceneId = crypto.randomUUID();
    const slug = await this.allocateUntitledSlug(universeId);
    const now = Date.now();
    const title = this.transloco.translate('general.message.untitledStory');
    const metaData: StoredStory = {
      slug,
      title,
      inGameDate: {},
      authorUid,
      draft: true,
      createdAt: now,
      version: 1,
      updatedAt: now,
    };
    // Auto-seed a title showcase scene wired to the author's first
    // content scene. The intro inherits whatever cover the author
    // picks later through the asset-resolution fallback; until then
    // the centered title acts as the visual.
    const contentData: StoredStoryContent = {
      defaultEntrySceneId: introSceneId,
      scenes: {
        [introSceneId]: {
          text: title,
          characters: [],
          position: { x: 0, y: 0 },
          layout: 'showcase',
          next: [{ sceneId: contentSceneId }],
          label: this.transloco.translate('editor.empty.introSceneText'),
        },
        [contentSceneId]: {
          text: '',
          characters: [],
          position: { x: 360, y: 0 },
          next: [],
          label: this.transloco.translate('editor.empty.contentSceneLabel'),
        },
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
    this.bus.publishEntityWrite({ universeId, kind: 'story', id });
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
    this.bus.publishEntityWrite({ universeId, kind: 'story', id });
    // Outbound connections belong to the deleted story; inbound ones
    // belong to other authors' entities and stay behind as broken
    // edges with editor fix actions. Best-effort: a failed cascade
    // leaves orphans that the same broken-edge handling covers.
    try {
      await this.connections.deleteOutboundFor({ kind: 'story', id });
    } catch {
      // ignore — broken-edge rendering covers leftovers
    }
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

/**
 * One-shot read-side migration for legacy content docs: `audioAssetId`
 * maps onto `sfxAssetId`, `startSceneId` onto `defaultEntrySceneId`,
 * and dropped `nextRefs` (replaced by the connections collection) are
 * stripped so they never reach the UI. The next save rewrites the doc
 * without the legacy keys.
 */
export function normalizeStoryContent(raw: Record<string, unknown>): StoryContent {
  const rawScenes = (raw['scenes'] ?? {}) as Record<
    string,
    Scene & { audioAssetId?: string; nextRefs?: unknown }
  >;
  const scenes: Record<string, Scene> = {};
  for (const [id, scene] of Object.entries(rawScenes)) {
    const { audioAssetId, nextRefs: _dropped, ...rest } = scene;
    scenes[id] =
      audioAssetId && !rest.sfxAssetId ? { ...rest, sfxAssetId: audioAssetId } : rest;
  }
  return {
    defaultEntrySceneId: (raw['defaultEntrySceneId'] ?? raw['startSceneId'] ?? '') as string,
    scenes,
  };
}
