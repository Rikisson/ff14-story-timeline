import { EntityKind, EntityRef, InGameDate } from '@shared/models';
import { foldLabel } from '@shared/utils';
import { Calendar } from '@features/calendar';
import { Character } from '@features/characters';
import { CodexCategoriesConfig, CodexEntry } from '@features/codex';
import { Connection, ConnectionSource, ConnectionTarget } from '@features/connections';
import { TimelineEvent } from '@features/events';
import { Place } from '@features/places';
import { Plotline } from '@features/plotlines';
import { Scene, StagedCharacter, Story, StoryContent } from '@features/stories';
import { Universe } from '@features/universes';
import { AssetDoc } from '@features/media';
import {
  ArchiveAsset,
  ArchiveCalendar,
  ArchiveCharacter,
  ArchiveCodexCategory,
  ArchiveCodexEntry,
  ArchiveConnection,
  ArchiveConnectionSource,
  ArchiveConnectionTarget,
  ArchiveEvent,
  ArchiveInGameDate,
  ArchivePlace,
  ArchivePlotline,
  ArchiveRef,
  ArchiveScene,
  ArchiveStory,
  ArchiveUniverse,
  FORMAT_VERSION,
  UniverseArchive,
} from './archive-format';
import { KindSlugMap, rewriteInlineTokensToSlugs, toArchiveRef } from './resolve-refs';

export interface ExportStoryInput {
  story: Story;
  content: StoryContent;
}

export interface ExportInput {
  universe: Universe;
  calendar?: Calendar;
  categories?: CodexCategoriesConfig;
  assets: readonly AssetDoc[];
  characters: readonly Character[];
  places: readonly Place[];
  plotlines: readonly Plotline[];
  events: readonly TimelineEvent[];
  codexEntries: readonly CodexEntry[];
  stories: readonly ExportStoryInput[];
  connections: readonly Connection[];
  generator?: string;
}

export interface AssetExportPlan {
  assetId: string;
  url: string;
  file: string;
  thumbUrl?: string;
  thumbFile?: string;
}

export interface ExportArchiveResult {
  archive: UniverseArchive;
  assetPlan: AssetExportPlan[];
}

interface ExportMaps {
  slugById: KindSlugMap;
  assetSlugById: Map<string, string>;
  eraSlugById: Map<string, string>;
}

export function buildUniverseArchive(input: ExportInput): ExportArchiveResult {
  const slugById = buildSlugById(input);
  const assets = buildAssets(input.assets);
  const calendar = buildCalendar(input.calendar);
  const maps: ExportMaps = {
    slugById,
    assetSlugById: assets.slugById,
    eraSlugById: calendar.eraSlugById,
  };

  const sceneKeysByStoryId = new Map<string, Map<string, string>>();
  const archive: UniverseArchive = compact({
    formatVersion: FORMAT_VERSION,
    exportedAt: Date.now(),
    generator: input.generator,
    universe: toArchiveUniverse(input.universe, maps),
    calendar: calendar.archive,
    codexCategories: input.categories ? toArchiveCategories(input.categories) : undefined,
    assets: assets.list.length > 0 ? assets.list : undefined,
    characters: mapList(input.characters, (item) => toArchiveCharacter(item, maps)),
    places: mapList(input.places, (item) => toArchivePlace(item, maps)),
    plotlines: mapList(input.plotlines, (item) => toArchivePlotline(item, maps)),
    events: mapList(input.events, (item) => toArchiveEvent(item, maps)),
    codexEntries: mapList(input.codexEntries, (item) => toArchiveCodexEntry(item, maps)),
    stories: mapList(input.stories, (item) => toArchiveStory(item, maps, sceneKeysByStoryId)),
    connections: toArchiveConnections(input.connections, maps, sceneKeysByStoryId),
  });

  return { archive, assetPlan: assets.plan };
}

// Connections ride along automatically: an edge whose endpoint isn't in
// the export set (entity unselected, or a stale source scene) is
// silently dropped, mirroring how `refList` drops unresolvable refs.
function toArchiveConnections(
  connections: readonly Connection[],
  maps: ExportMaps,
  sceneKeys: Map<string, Map<string, string>>,
): ArchiveConnection[] | undefined {
  const out: ArchiveConnection[] = [];
  for (const connection of connections) {
    const from = toArchiveEndpoint(connection.from, maps, sceneKeys) as
      | ArchiveConnectionSource
      | null;
    if (!from) continue;
    let to: ArchiveConnectionTarget | null = null;
    if (connection.to !== null) {
      to = toArchiveEndpoint(connection.to, maps, sceneKeys);
      if (!to) continue;
    }
    out.push(
      compact({
        type: 'continues' as const,
        from,
        to,
        visibility: connection.visibility,
        note: connection.note,
        snapshotTitle: connection.snapshotTitle,
      }),
    );
  }
  return out.length > 0 ? out : undefined;
}

function toArchiveEndpoint(
  endpoint: ConnectionSource | ConnectionTarget,
  maps: ExportMaps,
  sceneKeys: Map<string, Map<string, string>>,
): ArchiveConnectionTarget | null {
  if (endpoint.kind === 'event') {
    const slug = maps.slugById.event.get(endpoint.eventId);
    return slug ? { kind: 'event', event: slug } : null;
  }
  const slug = maps.slugById.story.get(endpoint.storyId);
  if (!slug) return null;
  if (endpoint.sceneId === undefined) return { kind: 'story', story: slug };
  const scene = sceneKeys.get(endpoint.storyId)?.get(endpoint.sceneId);
  return scene ? { kind: 'story', story: slug, scene } : null;
}

function toArchiveUniverse(universe: Universe, maps: ExportMaps): ArchiveUniverse {
  return compact({
    slug: universe.slug,
    name: universe.name,
    description: universe.description,
    locale: universe.locale,
    coverAsset: assetSlug(universe.coverAssetId, maps),
  });
}

function toArchiveCharacter(character: Character, maps: ExportMaps): ArchiveCharacter {
  return compact({
    slug: character.slug,
    name: character.name,
    description: inlineText(character.description, maps),
    coverAsset: assetSlug(character.coverAssetId, maps),
    sprites: assetSlugList(character.sprites, maps),
    relatedRefs: refList(character.relatedRefs, maps),
  });
}

function toArchivePlace(place: Place, maps: ExportMaps): ArchivePlace {
  return compact({
    slug: place.slug,
    name: place.name,
    description: inlineText(place.description, maps),
    coverAsset: assetSlug(place.coverAssetId, maps),
    backgrounds: assetSlugList(place.backgrounds, maps),
    ambientAudio: assetSlugList(place.ambientAudio, maps),
    relatedRefs: refList(place.relatedRefs, maps),
  });
}

function toArchivePlotline(plotline: Plotline, maps: ExportMaps): ArchivePlotline {
  return compact({
    slug: plotline.slug,
    title: plotline.title,
    description: inlineText(plotline.description, maps),
    coverAsset: assetSlug(plotline.coverAssetId, maps),
    color: plotline.color,
    status: plotline.status,
  });
}

function toArchiveEvent(event: TimelineEvent, maps: ExportMaps): ArchiveEvent {
  return compact({
    slug: event.slug,
    name: event.name,
    description: rewriteInlineTokensToSlugs(event.description, maps.slugById),
    coverAsset: assetSlug(event.coverAssetId, maps),
    bgmAsset: assetSlug(event.bgmAssetId, maps),
    backgroundEffect: event.backgroundEffect,
    inGameDate: toArchiveDate(event.inGameDate, maps),
    relatedRefs: refList(event.relatedRefs, maps),
    plotlineRefs: refList(event.plotlineRefs, maps),
  });
}

function toArchiveCodexEntry(entry: CodexEntry, maps: ExportMaps): ArchiveCodexEntry {
  return compact({
    slug: entry.slug,
    title: entry.title,
    category: entry.categoryKey,
    description: rewriteInlineTokensToSlugs(entry.description, maps.slugById),
    coverAsset: assetSlug(entry.coverAssetId, maps),
    relatedRefs: refList(entry.relatedRefs, maps),
  });
}

function toArchiveStory(
  input: ExportStoryInput,
  maps: ExportMaps,
  sceneKeysByStoryId: Map<string, Map<string, string>>,
): ArchiveStory {
  const { story, content } = input;
  const sceneIds = Object.keys(content.scenes);
  const keyBySceneId = new Map<string, string>();
  const usedKeys = new Set<string>();
  sceneIds.forEach((id, index) => {
    const base = foldLabel(content.scenes[id]?.label ?? '') || `scene-${index + 1}`;
    keyBySceneId.set(id, uniqueName(base, usedKeys));
  });
  sceneKeysByStoryId.set(story.id, keyBySceneId);

  const scenes: Record<string, ArchiveScene> = {};
  for (const id of sceneIds) {
    const key = keyBySceneId.get(id) as string;
    scenes[key] = toArchiveScene(content.scenes[id], keyBySceneId, maps);
  }

  return compact({
    slug: story.slug,
    title: story.title,
    description: inlineText(story.description, maps),
    coverAsset: assetSlug(story.coverAssetId, maps),
    bgmAsset: assetSlug(story.bgmAssetId, maps),
    draft: story.draft,
    inGameDate: toArchiveDate(story.inGameDate, maps),
    relatedRefs: refList(story.relatedRefs, maps),
    plotlineRefs: refList(story.plotlineRefs, maps),
    defaultEntryScene: keyBySceneId.get(content.defaultEntrySceneId) ?? sceneIds[0] ?? 'start',
    scenes,
  });
}

function toArchiveScene(
  scene: Scene,
  keyBySceneId: Map<string, string>,
  maps: ExportMaps,
): ArchiveScene {
  return compact({
    text: rewriteInlineTokensToSlugs(scene.text, maps.slugById),
    label: scene.label,
    speaker: toArchiveSpeaker(scene.speaker, maps),
    backgroundAsset: assetSlug(scene.backgroundAssetId, maps),
    backgroundEffect: scene.backgroundEffect,
    characters: scene.characters.map((staged) => toArchiveStaged(staged, maps)),
    place: scene.place ? (toArchiveRef(scene.place, maps.slugById) ?? undefined) : undefined,
    sfxAsset: assetSlug(scene.sfxAssetId, maps),
    bgmAsset: assetSlug(scene.bgmAssetId, maps),
    bgmSilence: scene.bgmSilence,
    bgmTransition: scene.bgmTransition,
    textSpeed: scene.textSpeed,
    layout: scene.layout,
    transition: scene.transition,
    transitionMs: scene.transitionMs,
    position: scene.position,
    next: scene.next.map((branch) =>
      compact({ label: branch.label, scene: keyBySceneId.get(branch.sceneId) ?? branch.sceneId }),
    ),
    isEntry: scene.isEntry,
  });
}

function toArchiveStaged(staged: StagedCharacter, maps: ExportMaps) {
  return compact({
    entity: toArchiveRef(staged.entity, maps.slugById) ?? {
      kind: 'character' as const,
      ref: staged.entity.id,
    },
    position: staged.position,
    order: staged.order,
    sprite: assetSlug(staged.spriteId, maps),
    facing: staged.facing,
  });
}

function toArchiveSpeaker(
  speaker: EntityRef<'character'> | string | undefined,
  maps: ExportMaps,
): ArchiveRef<'character'> | string | undefined {
  if (speaker === undefined || typeof speaker === 'string') return speaker;
  return toArchiveRef(speaker, maps.slugById) ?? undefined;
}

function toArchiveCategories(config: CodexCategoriesConfig): ArchiveCodexCategory[] | undefined {
  const categories = config.categories
    .filter((category) => category.key)
    .map((category) =>
      compact({
        key: category.key as string,
        label: category.label,
        color: category.color,
        description: category.description,
      }),
    );
  return categories.length > 0 ? categories : undefined;
}

function buildSlugById(input: ExportInput): KindSlugMap {
  const slugById: KindSlugMap = {
    character: new Map(),
    place: new Map(),
    event: new Map(),
    story: new Map(),
    plotline: new Map(),
    codexEntry: new Map(),
  };
  for (const item of input.characters) slugById.character.set(item.id, item.slug);
  for (const item of input.places) slugById.place.set(item.id, item.slug);
  for (const item of input.plotlines) slugById.plotline.set(item.id, item.slug);
  for (const item of input.events) slugById.event.set(item.id, item.slug);
  for (const item of input.codexEntries) slugById.codexEntry.set(item.id, item.slug);
  for (const item of input.stories) slugById.story.set(item.story.id, item.story.slug);
  return slugById;
}

function buildAssets(assets: readonly AssetDoc[]): {
  list: ArchiveAsset[];
  slugById: Map<string, string>;
  plan: AssetExportPlan[];
} {
  const used = new Set<string>();
  const slugById = new Map<string, string>();
  const list: ArchiveAsset[] = [];
  const plan: AssetExportPlan[] = [];

  for (const asset of assets) {
    const slug = uniqueName(foldLabel(asset.label) || asset.kind, used);
    slugById.set(asset.id, slug);
    const file = `assets/${slug}.${urlExtension(asset.url)}`;
    const thumbFile = asset.thumbUrl
      ? `assets/${slug}.thumb.${urlExtension(asset.thumbUrl)}`
      : undefined;
    list.push(
      compact({
        slug,
        kind: asset.kind,
        label: asset.label,
        file,
        thumbFile,
        blurDataUrl: asset.blurDataUrl,
        tags: asset.tags && asset.tags.length > 0 ? asset.tags : undefined,
      }),
    );
    plan.push(
      compact({ assetId: asset.id, url: asset.url, file, thumbUrl: asset.thumbUrl, thumbFile }),
    );
  }

  return { list, slugById, plan };
}

function buildCalendar(calendar: Calendar | undefined): {
  archive: ArchiveCalendar | undefined;
  eraSlugById: Map<string, string>;
} {
  const eraSlugById = new Map<string, string>();
  if (!calendar || (calendar.eras.length === 0 && calendar.months.length === 0)) {
    return { archive: undefined, eraSlugById };
  }

  const used = new Set<string>();
  const eras = calendar.eras.map((era) => {
    const slug = uniqueName(era.slug || foldLabel(era.name) || 'era', used);
    eraSlugById.set(era.id, slug);
    return compact({
      slug,
      name: era.name,
      maxYears: era.maxYears,
      hoursPerDay: era.hoursPerDay,
      minutesPerHour: era.minutesPerHour,
      secondsPerMinute: era.secondsPerMinute,
      resetsWeek: era.resetsWeek,
    });
  });

  const archive: ArchiveCalendar = compact({
    eras,
    months: calendar.months.map((month) => ({ name: month.name, days: month.days })),
    weekdays:
      calendar.weekdays && calendar.weekdays.length > 0
        ? calendar.weekdays.map((weekday) => compact({ name: weekday.name, short: weekday.short }))
        : undefined,
  });

  return { archive, eraSlugById };
}

function toArchiveDate(date: InGameDate | undefined, maps: ExportMaps): ArchiveInGameDate {
  if (!date) return {};
  const era = date.era ? maps.eraSlugById.get(date.era) : undefined;
  return compact({ ...date, era });
}

function refList<K extends EntityKind>(
  refs: readonly EntityRef<K>[] | undefined,
  maps: ExportMaps,
): ArchiveRef<K>[] | undefined {
  if (!refs || refs.length === 0) return undefined;
  const resolved = refs
    .map((ref) => toArchiveRef(ref, maps.slugById))
    .filter((ref): ref is ArchiveRef<K> => ref !== null);
  return resolved.length > 0 ? resolved : undefined;
}

function assetSlug(id: string | undefined, maps: ExportMaps): string | undefined {
  return id ? maps.assetSlugById.get(id) : undefined;
}

function assetSlugList(ids: readonly string[] | undefined, maps: ExportMaps): string[] | undefined {
  if (!ids || ids.length === 0) return undefined;
  const resolved = ids
    .map((id) => maps.assetSlugById.get(id))
    .filter((slug): slug is string => slug !== undefined);
  return resolved.length > 0 ? resolved : undefined;
}

function inlineText(text: string | undefined, maps: ExportMaps): string | undefined {
  return text ? rewriteInlineTokensToSlugs(text, maps.slugById) : undefined;
}

function mapList<T, R>(list: readonly T[], transform: (item: T) => R): R[] | undefined {
  return list.length > 0 ? list.map(transform) : undefined;
}

function uniqueName(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  used.add(candidate);
  return candidate;
}

function urlExtension(url: string): string {
  const path = (url.split(/[?#]/)[0] ?? '').split('/').pop() ?? '';
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'bin';
  const ext = path.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'bin';
}

function compact<T extends object>(obj: T): T {
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) delete record[key];
  }
  return obj;
}
