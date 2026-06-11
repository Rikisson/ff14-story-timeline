import { EntityKind, EntityRef, InGameDate } from '@shared/models';
import { StoredCodexEntry } from '@features/codex';
import {
  ConnectionSource,
  ConnectionTarget,
  StoredConnection,
  connectionIdFor,
  deriveConnectionKeys,
} from '@features/connections';
import { StoredTimelineEvent } from '@features/events';
import { StoredPlace } from '@features/places';
import { PlotlineMember, StoredPlotline, deriveMemberKeys } from '@features/plotlines';
import { Scene, StagedCharacter, StoredStory, StoryContent } from '@features/stories';
import { StoredCharacter } from '@features/characters';
import { autoLayoutScenes } from './auto-layout-scenes';
import {
  ArchiveCharacter,
  ArchiveCodexEntry,
  ArchiveConnectionSource,
  ArchiveConnectionTarget,
  ArchiveEvent,
  ArchiveInGameDate,
  ArchivePlace,
  ArchivePlotline,
  ArchiveRef,
  ArchiveScene,
  ArchiveStory,
  COLLECTION_BY_KIND,
  UniverseArchive,
} from './archive-format';
import { ImportAction, ImportResolution, ResolvedEntity } from './mint-ids';
import { resolveArchiveRef, rewriteInlineTokensToIds } from './resolve-refs';

export interface BuildDocsContext {
  resolution: ImportResolution;
  authorUid: string;
  now: number;
  idGen: () => string;
}

export interface BuiltEntityDoc {
  kind: EntityKind;
  id: string;
  slug: string;
  archiveSlug: string;
  action: ImportAction;
  collection: string;
  doc: Record<string, unknown>;
  content?: StoryContent;
}

export interface BuiltConnectionDoc {
  id: string;
  doc: StoredConnection;
}

export interface BuildDocsResult {
  docs: BuiltEntityDoc[];
  connections: BuiltConnectionDoc[];
}

export function buildCanonicalDocs(
  archive: UniverseArchive,
  ctx: BuildDocsContext,
): BuildDocsResult {
  const characters = bySlug(archive.characters);
  const places = bySlug(archive.places);
  const plotlines = bySlug(archive.plotlines);
  const events = bySlug(archive.events);
  const codexEntries = bySlug(archive.codexEntries);
  const stories = bySlug(archive.stories);

  const sceneIdsByStorySlug = new Map<string, Map<string, string>>();
  const docs: BuiltEntityDoc[] = [];
  for (const resolved of ctx.resolution.entities) {
    if (resolved.action === 'skip') continue;
    switch (resolved.kind) {
      case 'character': {
        const source = characters.get(resolved.archiveSlug);
        if (source) docs.push(wrap(resolved, buildCharacter(source, resolved.finalSlug, ctx)));
        break;
      }
      case 'place': {
        const source = places.get(resolved.archiveSlug);
        if (source) docs.push(wrap(resolved, buildPlace(source, resolved.finalSlug, ctx)));
        break;
      }
      case 'plotline': {
        const source = plotlines.get(resolved.archiveSlug);
        if (source) docs.push(wrap(resolved, buildPlotline(source, resolved.finalSlug, ctx)));
        break;
      }
      case 'event': {
        const source = events.get(resolved.archiveSlug);
        if (source) docs.push(wrap(resolved, buildEvent(source, resolved.finalSlug, ctx)));
        break;
      }
      case 'codexEntry': {
        const source = codexEntries.get(resolved.archiveSlug);
        if (source) docs.push(wrap(resolved, buildCodexEntry(source, resolved.finalSlug, ctx)));
        break;
      }
      case 'story': {
        const source = stories.get(resolved.archiveSlug);
        if (source) docs.push(buildStory(source, resolved, ctx, sceneIdsByStorySlug));
        break;
      }
    }
  }
  return { docs, connections: buildConnections(archive, ctx, sceneIdsByStorySlug) };
}

// Endpoints resolve strictly inside the archive: a connection whose
// story endpoint was skipped (or whose scene key no longer exists) is
// dropped rather than imported dangling — scene keys carry no meaning
// against the destination universe.
function buildConnections(
  archive: UniverseArchive,
  ctx: BuildDocsContext,
  sceneIdsByStorySlug: Map<string, Map<string, string>>,
): BuiltConnectionDoc[] {
  const out: BuiltConnectionDoc[] = [];
  for (const source of archive.connections ?? []) {
    const from = resolveEndpoint(source.from, ctx, sceneIdsByStorySlug);
    if (!from || (from.kind === 'story' && from.sceneId === undefined)) continue;
    let to: ConnectionTarget | null = null;
    if (source.to !== null) {
      to = resolveEndpoint(source.to, ctx, sceneIdsByStorySlug);
      if (!to) continue;
    }
    const fromSource = from as ConnectionSource;
    const doc: StoredConnection = compact({
      type: 'continues' as const,
      from: fromSource,
      to,
      ...deriveConnectionKeys(fromSource, to),
      visibility: source.visibility,
      note: source.note,
      snapshotTitle: source.snapshotTitle,
      createdBy: ctx.authorUid,
      updatedBy: ctx.authorUid,
      updatedAt: ctx.now,
    });
    out.push({ id: connectionIdFor(fromSource), doc });
  }
  return out;
}

function resolveEndpoint(
  endpoint: ArchiveConnectionSource | ArchiveConnectionTarget,
  ctx: BuildDocsContext,
  sceneIdsByStorySlug: Map<string, Map<string, string>>,
): ConnectionTarget | null {
  if (endpoint.kind === 'event') {
    const eventId = ctx.resolution.idBySlug.event.get(endpoint.event);
    return eventId ? { kind: 'event', eventId } : null;
  }
  const storyId = ctx.resolution.idBySlug.story.get(endpoint.story);
  if (!storyId) return null;
  if (endpoint.scene === undefined) return { kind: 'story', storyId };
  const sceneId = sceneIdsByStorySlug.get(endpoint.story)?.get(endpoint.scene);
  return sceneId ? { kind: 'story', storyId, sceneId } : null;
}

function buildCharacter(
  source: ArchiveCharacter,
  slug: string,
  ctx: BuildDocsContext,
): StoredCharacter {
  return compact({
    slug,
    name: source.name,
    description: source.description,
    coverAssetId: resolveAsset(source.coverAsset, ctx),
    sprites: resolveAssetList(source.sprites, ctx),
    relatedRefs: resolveRefList(source.relatedRefs, ctx),
    authorUid: ctx.authorUid,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
}

function buildPlace(source: ArchivePlace, slug: string, ctx: BuildDocsContext): StoredPlace {
  return compact({
    slug,
    name: source.name,
    description: source.description,
    coverAssetId: resolveAsset(source.coverAsset, ctx),
    backgrounds: resolveAssetList(source.backgrounds, ctx),
    ambientAudio: resolveAssetList(source.ambientAudio, ctx),
    relatedRefs: resolveRefList(source.relatedRefs, ctx),
    authorUid: ctx.authorUid,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
}

function buildPlotline(
  source: ArchivePlotline,
  slug: string,
  ctx: BuildDocsContext,
): StoredPlotline {
  const members = resolveRefList(source.members, ctx) as PlotlineMember[] | undefined;
  return compact({
    slug,
    title: source.title,
    description: source.description,
    coverAssetId: resolveAsset(source.coverAsset, ctx),
    color: source.color,
    status: source.status,
    members,
    memberKeys: members ? deriveMemberKeys(members) : undefined,
    authorUid: ctx.authorUid,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
}

function buildEvent(
  source: ArchiveEvent,
  slug: string,
  ctx: BuildDocsContext,
): StoredTimelineEvent {
  return compact({
    slug,
    name: source.name,
    description: rewriteInlineTokensToIds(source.description, ctx.resolution.idBySlug),
    coverAssetId: resolveAsset(source.coverAsset, ctx),
    bgmAssetId: resolveAsset(source.bgmAsset, ctx),
    backgroundEffect: source.backgroundEffect,
    inGameDate: resolveDate(source.inGameDate, ctx),
    relatedRefs: resolveRefList(source.relatedRefs, ctx),
    authorUid: ctx.authorUid,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
}

function buildCodexEntry(
  source: ArchiveCodexEntry,
  slug: string,
  ctx: BuildDocsContext,
): StoredCodexEntry {
  return compact({
    slug,
    title: source.title,
    categoryKey: source.category,
    description: rewriteInlineTokensToIds(source.description, ctx.resolution.idBySlug),
    coverAssetId: resolveAsset(source.coverAsset, ctx),
    relatedRefs: resolveRefList(source.relatedRefs, ctx),
    authorUid: ctx.authorUid,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
}

function buildStory(
  source: ArchiveStory,
  resolved: ResolvedEntity,
  ctx: BuildDocsContext,
  sceneIdsByStorySlug: Map<string, Map<string, string>>,
): BuiltEntityDoc {
  const sceneKeyToId = new Map<string, string>();
  for (const key of Object.keys(source.scenes)) sceneKeyToId.set(key, ctx.idGen());
  sceneIdsByStorySlug.set(resolved.archiveSlug, sceneKeyToId);

  const needsLayout = Object.values(source.scenes).some((scene) => !scene.position);
  const layout = needsLayout ? autoLayoutScenes(source.scenes, source.defaultEntryScene) : null;

  const scenes: Record<string, Scene> = {};
  for (const [key, archiveScene] of Object.entries(source.scenes)) {
    const sceneId = sceneKeyToId.get(key) as string;
    scenes[sceneId] = buildScene(archiveScene, key, sceneKeyToId, layout, ctx);
  }

  const doc = compact<StoredStory>({
    slug: resolved.finalSlug,
    title: source.title,
    description: source.description,
    coverAssetId: resolveAsset(source.coverAsset, ctx),
    bgmAssetId: resolveAsset(source.bgmAsset, ctx),
    inGameDate: resolveDate(source.inGameDate, ctx),
    relatedRefs: resolveRefList(source.relatedRefs, ctx),
    authorUid: ctx.authorUid,
    draft: source.draft ?? false,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    publishedAt: source.draft ? undefined : ctx.now,
  });

  const content: StoryContent = {
    defaultEntrySceneId: sceneKeyToId.get(source.defaultEntryScene) ?? '',
    scenes,
  };

  return {
    kind: 'story',
    id: resolved.id,
    slug: resolved.finalSlug,
    archiveSlug: resolved.archiveSlug,
    action: resolved.action,
    collection: 'stories',
    doc,
    content,
  };
}

function buildScene(
  source: ArchiveScene,
  key: string,
  sceneKeyToId: Map<string, string>,
  layout: Map<string, { x: number; y: number }> | null,
  ctx: BuildDocsContext,
): Scene {
  const characters: StagedCharacter[] = (source.characters ?? [])
    .map((staged) => {
      const entity = resolveArchiveRef(staged.entity, ctx.resolution.idBySlug);
      if (!entity) return null;
      return compact<StagedCharacter>({
        entity,
        position: staged.position,
        order: staged.order,
        spriteId: resolveAsset(staged.sprite, ctx),
        facing: staged.facing,
      });
    })
    .filter((staged): staged is StagedCharacter => staged !== null);

  const next = (source.next ?? []).map((branch) =>
    compact({ label: branch.label, sceneId: sceneKeyToId.get(branch.scene) ?? '' }),
  );

  return compact<Scene>({
    text: rewriteInlineTokensToIds(source.text ?? '', ctx.resolution.idBySlug),
    label: source.label,
    speaker: resolveSpeaker(source.speaker, ctx),
    backgroundAssetId: resolveAsset(source.backgroundAsset, ctx),
    backgroundEffect: source.backgroundEffect,
    characters,
    place: resolveTypedRef<'place'>(source.place, ctx),
    sfxAssetId: resolveAsset(source.sfxAsset, ctx),
    bgmAssetId: resolveAsset(source.bgmAsset, ctx),
    bgmSilence: source.bgmSilence,
    bgmTransition: source.bgmTransition,
    textSpeed: source.textSpeed,
    layout: source.layout,
    transition: source.transition,
    transitionMs: source.transitionMs,
    position: source.position ?? layout?.get(key) ?? { x: 0, y: 0 },
    next,
    isEntry: source.isEntry,
  });
}

function resolveSpeaker(
  speaker: ArchiveScene['speaker'],
  ctx: BuildDocsContext,
): EntityRef<'character'> | string | undefined {
  if (speaker === undefined) return undefined;
  if (typeof speaker === 'string') return speaker;
  return resolveTypedRef<'character'>(speaker, ctx);
}

function resolveTypedRef<K extends EntityKind>(
  ref: ArchiveRef | undefined,
  ctx: BuildDocsContext,
): EntityRef<K> | undefined {
  if (!ref) return undefined;
  const resolved = resolveArchiveRef(ref, ctx.resolution.idBySlug);
  return resolved ? (resolved as EntityRef<K>) : undefined;
}

function resolveRefList(
  refs: readonly ArchiveRef[] | undefined,
  ctx: BuildDocsContext,
): EntityRef[] | undefined {
  if (!refs || refs.length === 0) return undefined;
  const resolved = refs
    .map((ref) => resolveArchiveRef(ref, ctx.resolution.idBySlug))
    .filter((ref): ref is EntityRef => ref !== null);
  return resolved.length > 0 ? resolved : undefined;
}

function resolveAsset(slug: string | undefined, ctx: BuildDocsContext): string | undefined {
  return slug ? ctx.resolution.assetIdBySlug.get(slug) : undefined;
}

function resolveAssetList(
  slugs: readonly string[] | undefined,
  ctx: BuildDocsContext,
): string[] | undefined {
  if (!slugs || slugs.length === 0) return undefined;
  const resolved = slugs
    .map((slug) => ctx.resolution.assetIdBySlug.get(slug))
    .filter((id): id is string => id !== undefined);
  return resolved.length > 0 ? resolved : undefined;
}

function resolveDate(date: ArchiveInGameDate | undefined, ctx: BuildDocsContext): InGameDate {
  if (!date) return {};
  const era = date.era ? ctx.resolution.eraIdBySlug.get(date.era) : undefined;
  return compact({ ...date, era });
}

function wrap(resolved: ResolvedEntity, doc: Record<string, unknown>): BuiltEntityDoc {
  return {
    kind: resolved.kind,
    id: resolved.id,
    slug: resolved.finalSlug,
    archiveSlug: resolved.archiveSlug,
    action: resolved.action,
    collection: COLLECTION_BY_KIND[resolved.kind],
    doc,
  };
}

function bySlug<T extends { slug: string }>(list: readonly T[] | undefined): Map<string, T> {
  return new Map((list ?? []).map((item) => [item.slug, item] as const));
}

function compact<T extends object>(obj: T): T {
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (record[key] === undefined) delete record[key];
  }
  return obj;
}
