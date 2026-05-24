import { inject, Injectable } from '@angular/core';
import { doc, setDoc } from 'firebase/firestore/lite';
import { buildCharacterDirectoryInputs } from '@features/characters';
import {
  buildCodexEntryDirectoryInputs,
  CodexCategoriesConfig,
  CodexCategoriesProjectionContext,
} from '@features/codex';
import {
  buildEventDirectoryInputs,
  buildEventTimelineInputs,
} from '@features/events';
import { Calendar, CalendarProjectionContext } from '@features/calendar';
import { buildPlaceDirectoryInputs } from '@features/places';
import { buildPlotlineDirectoryInputs } from '@features/plotlines';
import {
  buildStoryDirectoryInputs,
  buildStoryTimelineInputs,
} from '@features/stories';
import { DEFAULT_UNIVERSE_LOCALE, StoredUniverse } from '@features/universes';
import {
  buildProjectionRows,
  DirectoryRowInputs,
  entityRowKey,
  ProjectionRowsInputs,
  slugRowKey,
  TimelineRowInputs,
} from '@shared/data-access';
import { EntityKind } from '@shared/models';
import { getWeekdayIndex } from '@shared/utils';
import { FirebaseService } from '../app/firebase/firebase.service';
import {
  SEED_CALENDAR,
  SEED_CHARACTERS,
  SEED_CODEX_CATEGORIES,
  SEED_CODEX_ENTRIES,
  SEED_EVENTS,
  SEED_PLACES,
  SEED_PLOTLINES,
  SEED_STORIES,
} from './seed-data';

export const DEFAULT_UNIVERSE_ID = 'universe-default';
export const DEFAULT_UNIVERSE_SLUG = 'default-universe';

const DIRECTORY = '_directory';
const TIMELINE = '_timelineEntries';
const LANE = '_timelineLaneEntries';
const SLUG_INDEX = '_slugIndex';

interface SeedItem {
  id: string;
  slug: string;
  createdAt: number;
}

/**
 * Source-of-truth seeder for a fresh universe. Per
 * `docs/backend-rules.md` *Seed schema*: every collection the new code
 * reads must be populated at seed time — canonical entity docs,
 * `_slugIndex` claims, `_directory` projection rows, `_timelineEntries`
 * + `_timelineLaneEntries` rows for stories and events, and the two
 * `_meta` config docs.
 *
 * Writes use direct `setDoc` (no transaction) because the target is an
 * empty database; transactional slug-claim + fingerprint-diff semantics
 * add no value here. The row shapes match the live write path bit-for-bit
 * — both go through the same pure `buildProjectionRows` + per-kind
 * `build*DirectoryInputs` / `build*TimelineInputs` modules in
 * `@shared/data-access` and `@features/*`.
 */
@Injectable({ providedIn: 'root' })
export class SeederService {
  private readonly firebase = inject(FirebaseService);

  async seedDefaultUniverse(authorUid: string): Promise<void> {
    const data: StoredUniverse = {
      slug: DEFAULT_UNIVERSE_SLUG,
      name: 'Default universe',
      description: 'Seeded universe used for bootstrap data.',
      locale: DEFAULT_UNIVERSE_LOCALE,
      authorUid,
      editorUids: [],
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'universes', DEFAULT_UNIVERSE_ID), data);
  }

  async seedCharacters(authorUid: string): Promise<void> {
    await this.seedKind({
      kind: 'character',
      canonicalCollection: 'characters',
      items: SEED_CHARACTERS,
      authorUid,
      buildDirectory: (e) => buildCharacterDirectoryInputs(e),
    });
  }

  async seedPlaces(authorUid: string): Promise<void> {
    await this.seedKind({
      kind: 'place',
      canonicalCollection: 'places',
      items: SEED_PLACES,
      authorUid,
      buildDirectory: (e) => buildPlaceDirectoryInputs(e),
    });
  }

  async seedPlotlines(authorUid: string): Promise<void> {
    await this.seedKind({
      kind: 'plotline',
      canonicalCollection: 'plotlines',
      items: SEED_PLOTLINES,
      authorUid,
      buildDirectory: (e) => buildPlotlineDirectoryInputs(e),
    });
  }

  async seedEvents(authorUid: string): Promise<void> {
    const calendarCtx = makeCalendarContext(SEED_CALENDAR);
    await this.seedKind({
      kind: 'event',
      canonicalCollection: 'events',
      items: SEED_EVENTS,
      authorUid,
      buildDirectory: (e) => buildEventDirectoryInputs(e, calendarCtx),
      buildTimeline: (e) => buildEventTimelineInputs(e, calendarCtx),
    });
  }

  async seedCodexEntries(authorUid: string): Promise<void> {
    const codexCtx = makeCodexContext(SEED_CODEX_CATEGORIES);
    await this.seedKind({
      kind: 'codexEntry',
      canonicalCollection: 'codexEntries',
      items: SEED_CODEX_ENTRIES,
      authorUid,
      buildDirectory: (e) => buildCodexEntryDirectoryInputs(e, codexCtx),
    });
  }

  async seedStories(authorUid: string): Promise<void> {
    const db = this.firebase.firestore;
    const calendarCtx = makeCalendarContext(SEED_CALENDAR);

    const built = await Promise.all(
      SEED_STORIES.map(async ({ id, startSceneId, scenes, ...meta }) => {
        const story = { id, ...meta, authorUid };
        const rows = await buildProjectionRows(
          {
            kind: 'story',
            id,
            slug: story.slug,
            directory: buildStoryDirectoryInputs(story, calendarCtx),
            timeline: buildStoryTimelineInputs(story, calendarCtx),
          },
          story.updatedAt ?? story.createdAt,
        );
        return { id, story, content: { startSceneId, scenes }, rows };
      }),
    );

    await Promise.all(
      built.flatMap(({ id, story, content, rows }) => {
        const { id: _id, ...metaPayload } = story;
        const ops = [
          setDoc(
            doc(db, 'universes', DEFAULT_UNIVERSE_ID, 'stories', id),
            metaPayload,
          ),
          setDoc(
            doc(db, 'universes', DEFAULT_UNIVERSE_ID, 'stories', id, '_content', 'main'),
            content,
          ),
          setDoc(
            doc(db, 'universes', DEFAULT_UNIVERSE_ID, SLUG_INDEX, slugRowKey('story', story.slug)),
            { entityId: id },
          ),
          setDoc(
            doc(db, 'universes', DEFAULT_UNIVERSE_ID, DIRECTORY, entityRowKey('story', id)),
            rows.directoryRow,
          ),
        ];
        if (rows.timelineRow) {
          ops.push(
            setDoc(
              doc(db, 'universes', DEFAULT_UNIVERSE_ID, TIMELINE, entityRowKey('story', id)),
              rows.timelineRow,
            ),
            ...rows.laneRows.map((lane) =>
              setDoc(
                doc(db, 'universes', DEFAULT_UNIVERSE_ID, LANE, lane.rowKey),
                lane.row,
              ),
            ),
          );
        }
        return ops;
      }),
    );
  }

  async seedCalendar(): Promise<void> {
    await setDoc(
      doc(this.firebase.firestore, 'universes', DEFAULT_UNIVERSE_ID, '_meta', 'calendar'),
      SEED_CALENDAR,
    );
  }

  async seedCodexCategories(): Promise<void> {
    await setDoc(
      doc(this.firebase.firestore, 'universes', DEFAULT_UNIVERSE_ID, '_meta', 'codex_categories'),
      SEED_CODEX_CATEGORIES,
    );
  }

  async seedAll(authorUid: string): Promise<void> {
    await this.seedDefaultUniverse(authorUid);
    // Calendar + categories are needed by the event / codex projection
    // builders downstream, so seed them first.
    await Promise.all([this.seedCalendar(), this.seedCodexCategories()]);
    await Promise.all([
      this.seedCharacters(authorUid),
      this.seedPlaces(authorUid),
      this.seedPlotlines(authorUid),
      this.seedCodexEntries(authorUid),
      this.seedStories(authorUid),
      this.seedEvents(authorUid),
    ]);
  }

  private async seedKind<T extends SeedItem>(opts: {
    kind: EntityKind;
    canonicalCollection: string;
    items: T[];
    authorUid: string;
    buildDirectory: (entity: T) => DirectoryRowInputs;
    buildTimeline?: (entity: T) => TimelineRowInputs;
  }): Promise<void> {
    const db = this.firebase.firestore;

    const built = await Promise.all(
      opts.items.map(async (item) => {
        const inputs: ProjectionRowsInputs = {
          kind: opts.kind,
          id: item.id,
          slug: item.slug,
          directory: opts.buildDirectory(item),
        };
        if (opts.buildTimeline) inputs.timeline = opts.buildTimeline(item);
        const rows = await buildProjectionRows(inputs, item.createdAt);
        return { item, rows };
      }),
    );

    await Promise.all(
      built.flatMap(({ item, rows }) => {
        const { id, ...canonicalData } = item as T & { id: string };
        const canonicalPayload = { ...canonicalData, authorUid: opts.authorUid };
        const ops = [
          setDoc(
            doc(db, 'universes', DEFAULT_UNIVERSE_ID, opts.canonicalCollection, id),
            canonicalPayload,
          ),
          setDoc(
            doc(db, 'universes', DEFAULT_UNIVERSE_ID, SLUG_INDEX, slugRowKey(opts.kind, item.slug)),
            { entityId: id },
          ),
          setDoc(
            doc(db, 'universes', DEFAULT_UNIVERSE_ID, DIRECTORY, entityRowKey(opts.kind, id)),
            rows.directoryRow,
          ),
        ];
        if (rows.timelineRow) {
          ops.push(
            setDoc(
              doc(db, 'universes', DEFAULT_UNIVERSE_ID, TIMELINE, entityRowKey(opts.kind, id)),
              rows.timelineRow,
            ),
            ...rows.laneRows.map((lane) =>
              setDoc(
                doc(db, 'universes', DEFAULT_UNIVERSE_ID, LANE, lane.rowKey),
                lane.row,
              ),
            ),
          );
        }
        return ops;
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Projection-context constructors. Mirror the structures `CalendarService`
// and `CodexCategoriesService` would build at runtime but derive them
// from the static seed data so the seeder doesn't depend on the Angular
// services being hydrated.
// ---------------------------------------------------------------------------

function makeCalendarContext(calendar: Calendar): CalendarProjectionContext {
  const eraOrdinalById = new Map<string, number>();
  const eraNameById = new Map<string, string>();
  calendar.eras.forEach((e, i) => {
    eraOrdinalById.set(e.id, i);
    eraNameById.set(e.id, e.name);
  });
  const monthNameByIndex = new Map<number, string>();
  calendar.months.forEach((m, i) => monthNameByIndex.set(i + 1, m.name));
  const weekdays = calendar.weekdays ?? [];
  return {
    eraOrdinalLookup: (id) => eraOrdinalById.get(id),
    eraNameLookup: (id) => eraNameById.get(id),
    monthNameLookup: (month) => monthNameByIndex.get(month),
    weekdayLookup: (d) => {
      if (weekdays.length === 0) return undefined;
      const idx = getWeekdayIndex(d, {
        eras: calendar.eras,
        months: calendar.months,
        weekdayCount: weekdays.length,
      });
      return idx === null ? undefined : weekdays[idx]?.name;
    },
  };
}

function makeCodexContext(config: CodexCategoriesConfig): CodexCategoriesProjectionContext {
  const map = new Map<string, string>();
  for (const c of config.categories) {
    if (c.key) map.set(c.key, c.label);
  }
  return { categoryLabelByKey: map };
}
