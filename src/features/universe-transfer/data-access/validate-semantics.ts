import { EntityKind } from '@shared/models';
import { isRefSegment, parseRefs } from '@shared/utils';
import {
  ARCHIVE_ENTITY_KINDS,
  ArchiveRef,
  ArchiveScene,
  ArchiveStory,
  UniverseArchive,
} from './archive-format';
import { IssueSeverity, ValidationIssue } from './dry-run-report.types';
import { ImportContext, archiveEntitiesOf } from './mint-ids';

type SlugPool = Record<EntityKind, Set<string>>;

export function validateSemantics(archive: UniverseArchive, ctx: ImportContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entitySlugs = buildEntitySlugs(archive, ctx);
  const assetSlugs = new Set((archive.assets ?? []).map((asset) => asset.slug));
  const eraSlugs = buildEraSlugs(archive, ctx);
  const categoryKeys = buildCategoryKeys(archive, ctx);

  (archive.characters ?? []).forEach((character, index) => {
    const path = `characters[${index}]`;
    checkAsset(character.coverAsset, assetSlugs, `${path}.coverAsset`, issues);
    checkAssetList(character.sprites, assetSlugs, `${path}.sprites`, issues);
    checkRefList(character.relatedRefs, entitySlugs, `${path}.relatedRefs`, 'warning', issues);
    checkInlineText(character.description, entitySlugs, `${path}.description`, issues);
  });

  (archive.places ?? []).forEach((place, index) => {
    const path = `places[${index}]`;
    checkAsset(place.coverAsset, assetSlugs, `${path}.coverAsset`, issues);
    checkAssetList(place.backgrounds, assetSlugs, `${path}.backgrounds`, issues);
    checkAssetList(place.ambientAudio, assetSlugs, `${path}.ambientAudio`, issues);
    checkRefList(place.relatedRefs, entitySlugs, `${path}.relatedRefs`, 'warning', issues);
    checkInlineText(place.description, entitySlugs, `${path}.description`, issues);
  });

  (archive.plotlines ?? []).forEach((plotline, index) => {
    const path = `plotlines[${index}]`;
    checkAsset(plotline.coverAsset, assetSlugs, `${path}.coverAsset`, issues);
    checkInlineText(plotline.description, entitySlugs, `${path}.description`, issues);
  });

  (archive.events ?? []).forEach((event, index) => {
    const path = `events[${index}]`;
    checkAsset(event.coverAsset, assetSlugs, `${path}.coverAsset`, issues);
    checkAsset(event.bgmAsset, assetSlugs, `${path}.bgmAsset`, issues);
    checkRefList(event.relatedRefs, entitySlugs, `${path}.relatedRefs`, 'warning', issues);
    checkRefList(event.plotlineRefs, entitySlugs, `${path}.plotlineRefs`, 'error', issues);
    checkRefList(event.nextRefs, entitySlugs, `${path}.nextRefs`, 'error', issues);
    checkInlineText(event.description, entitySlugs, `${path}.description`, issues);
    checkEra(event.inGameDate?.era, eraSlugs, `${path}.inGameDate.era`, issues);
  });

  (archive.codexEntries ?? []).forEach((entry, index) => {
    const path = `codexEntries[${index}]`;
    checkAsset(entry.coverAsset, assetSlugs, `${path}.coverAsset`, issues);
    checkRefList(entry.relatedRefs, entitySlugs, `${path}.relatedRefs`, 'warning', issues);
    checkInlineText(entry.description, entitySlugs, `${path}.description`, issues);
    checkCategory(entry.category, categoryKeys, `${path}.category`, issues);
  });

  (archive.stories ?? []).forEach((story, index) => {
    checkStory(story, `stories[${index}]`, entitySlugs, assetSlugs, eraSlugs, issues);
  });

  return issues;
}

export function countCollisions(
  archive: UniverseArchive,
  ctx: ImportContext,
): Record<EntityKind, number> {
  const result: Record<EntityKind, number> = {
    character: 0,
    place: 0,
    event: 0,
    story: 0,
    plotline: 0,
    codexEntry: 0,
  };
  for (const kind of ARCHIVE_ENTITY_KINDS) {
    const existing = ctx.existingEntityIds[kind];
    for (const entity of archiveEntitiesOf(archive, kind)) {
      if (existing.has(entity.slug)) result[kind]++;
    }
  }
  return result;
}

function checkStory(
  story: ArchiveStory,
  path: string,
  entitySlugs: SlugPool,
  assetSlugs: Set<string>,
  eraSlugs: Set<string>,
  issues: ValidationIssue[],
): void {
  checkAsset(story.coverAsset, assetSlugs, `${path}.coverAsset`, issues);
  checkAsset(story.bgmAsset, assetSlugs, `${path}.bgmAsset`, issues);
  checkRefList(story.relatedRefs, entitySlugs, `${path}.relatedRefs`, 'warning', issues);
  checkRefList(story.plotlineRefs, entitySlugs, `${path}.plotlineRefs`, 'error', issues);
  checkEra(story.inGameDate?.era, eraSlugs, `${path}.inGameDate.era`, issues);

  for (const [key, scene] of Object.entries(story.scenes ?? {})) {
    checkScene(scene, `${path}.scenes.${key}`, entitySlugs, assetSlugs, issues);
  }
}

function checkScene(
  scene: ArchiveScene,
  path: string,
  entitySlugs: SlugPool,
  assetSlugs: Set<string>,
  issues: ValidationIssue[],
): void {
  checkInlineText(scene.text, entitySlugs, `${path}.text`, issues);
  checkAsset(scene.backgroundAsset, assetSlugs, `${path}.backgroundAsset`, issues);
  checkAsset(scene.sfxAsset, assetSlugs, `${path}.sfxAsset`, issues);
  checkAsset(scene.bgmAsset, assetSlugs, `${path}.bgmAsset`, issues);

  if (scene.speaker && typeof scene.speaker !== 'string') {
    checkRef(scene.speaker, entitySlugs, `${path}.speaker`, 'error', issues);
  }
  if (scene.place) {
    checkRef(scene.place, entitySlugs, `${path}.place`, 'error', issues);
  }
  checkRefList(scene.nextRefs, entitySlugs, `${path}.nextRefs`, 'error', issues);

  (scene.characters ?? []).forEach((staged, index) => {
    checkRef(staged.entity, entitySlugs, `${path}.characters[${index}].entity`, 'error', issues);
    checkAsset(staged.sprite, assetSlugs, `${path}.characters[${index}].sprite`, issues);
  });
}

function checkRefList(
  refs: readonly ArchiveRef[] | undefined,
  pool: SlugPool,
  path: string,
  severity: IssueSeverity,
  issues: ValidationIssue[],
): void {
  (refs ?? []).forEach((ref, index) => checkRef(ref, pool, `${path}[${index}]`, severity, issues));
}

function checkRef(
  ref: ArchiveRef,
  pool: SlugPool,
  path: string,
  severity: IssueSeverity,
  issues: ValidationIssue[],
): void {
  const slugs = pool[ref.kind];
  if (slugs.has(ref.ref)) return;
  issues.push({
    severity,
    code: 'ref-unresolved',
    path,
    message: `${path} references ${ref.kind} "${ref.ref}", which is not in the package or this universe.`,
    ...hintFor(ref.ref, slugs),
  });
}

function checkInlineText(
  text: string | undefined,
  pool: SlugPool,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!text) return;
  for (const segment of parseRefs(text)) {
    if (!isRefSegment(segment)) continue;
    const slugs = pool[segment.ref.kind];
    if (slugs.has(segment.ref.id)) continue;
    issues.push({
      severity: 'warning',
      code: 'inline-ref-unresolved',
      path,
      message: `${path}: inline reference to ${segment.ref.kind} "${segment.ref.id}" could not be resolved; it will render as plain text.`,
      ...hintFor(segment.ref.id, slugs),
    });
  }
}

function checkAsset(
  slug: string | undefined,
  assetSlugs: Set<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  if (slug === undefined) return;
  if (assetSlugs.has(slug)) return;
  issues.push({
    severity: 'warning',
    code: 'asset-missing',
    path,
    message: `${path} references asset "${slug}", which is not in the package; the slot will be empty.`,
    ...hintFor(slug, assetSlugs),
  });
}

function checkAssetList(
  slugs: readonly string[] | undefined,
  assetSlugs: Set<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  (slugs ?? []).forEach((slug, index) => checkAsset(slug, assetSlugs, `${path}[${index}]`, issues));
}

function checkEra(
  era: string | undefined,
  eraSlugs: Set<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  if (era === undefined) return;
  if (eraSlugs.has(era)) return;
  issues.push({
    severity: 'error',
    code: 'era-unresolved',
    path,
    message: `${path}: era "${era}" does not exist in this universe's calendar. Add it in Settings → Calendar, or include a matching calendar in the package.`,
    ...hintFor(era, eraSlugs),
  });
}

function checkCategory(
  category: string | undefined,
  categoryKeys: Set<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  if (category === undefined) return;
  if (categoryKeys.has(category)) return;
  issues.push({
    severity: 'error',
    code: 'category-unresolved',
    path,
    message: `${path}: category "${category}" does not exist. Add it in Settings → Categories, or include it in the package's codexCategories.`,
    ...hintFor(category, categoryKeys),
  });
}

function buildEntitySlugs(archive: UniverseArchive, ctx: ImportContext): SlugPool {
  const pool: SlugPool = {
    character: new Set(),
    place: new Set(),
    event: new Set(),
    story: new Set(),
    plotline: new Set(),
    codexEntry: new Set(),
  };
  for (const kind of ARCHIVE_ENTITY_KINDS) {
    for (const slug of ctx.existingEntityIds[kind].keys()) pool[kind].add(slug);
    for (const entity of archiveEntitiesOf(archive, kind)) pool[kind].add(entity.slug);
  }
  return pool;
}

function buildEraSlugs(archive: UniverseArchive, ctx: ImportContext): Set<string> {
  const willApplyCalendar = !ctx.targetHasCalendar && (archive.calendar?.eras.length ?? 0) > 0;
  if (willApplyCalendar) {
    return new Set((archive.calendar?.eras ?? []).map((era) => era.slug));
  }
  return new Set(ctx.existingEraIdBySlug.keys());
}

function buildCategoryKeys(archive: UniverseArchive, ctx: ImportContext): Set<string> {
  const keys = new Set(ctx.existingCategoryKeys);
  for (const category of archive.codexCategories ?? []) keys.add(category.key);
  return keys;
}

function hintFor(target: string, pool: Iterable<string>): { hint?: string } {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of pool) {
    const distance = levenshtein(target, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  const threshold = Math.max(2, Math.floor(target.length * 0.4));
  if (best !== undefined && bestDistance > 0 && bestDistance <= threshold) {
    return { hint: `Did you mean "${best}"?` };
  }
  return {};
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i++) {
    const current = [i];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[cols - 1] ?? 0;
}
