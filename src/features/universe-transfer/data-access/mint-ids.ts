import { EntityKind } from '@shared/models';
import { ARCHIVE_ENTITY_KINDS, UniverseArchive } from './archive-format';
import { ConflictResolution } from './dry-run-report.types';

export type ImportAction = 'create' | 'rename' | 'skip';

export interface ResolvedEntity {
  kind: EntityKind;
  archiveSlug: string;
  finalSlug: string;
  id: string;
  action: ImportAction;
}

export interface ImportContext {
  existingEntityIds: Record<EntityKind, Map<string, string>>;
  existingEraIdBySlug: Map<string, string>;
  existingCategoryKeys: Set<string>;
  targetHasCalendar: boolean;
}

export interface ImportResolution {
  entities: ResolvedEntity[];
  idBySlug: Record<EntityKind, Map<string, string>>;
  assetIdBySlug: Map<string, string>;
  eraIdBySlug: Map<string, string>;
  applyCalendar: boolean;
}

export type IdGenerator = () => string;

const defaultIdGenerator: IdGenerator = () => crypto.randomUUID();

export function resolveImport(
  archive: UniverseArchive,
  ctx: ImportContext,
  policy: Record<EntityKind, ConflictResolution>,
  idGen: IdGenerator = defaultIdGenerator,
): ImportResolution {
  const entities: ResolvedEntity[] = [];
  const idBySlug = blankKindMaps();

  for (const kind of ARCHIVE_ENTITY_KINDS) {
    const existing = ctx.existingEntityIds[kind];
    const used = new Set<string>(existing.keys());
    for (const [slug, id] of existing) idBySlug[kind].set(slug, id);

    for (const entity of archiveEntitiesOf(archive, kind)) {
      const slug = entity.slug;
      if (!existing.has(slug)) {
        const id = idGen();
        entities.push({ kind, archiveSlug: slug, finalSlug: slug, id, action: 'create' });
        idBySlug[kind].set(slug, id);
        used.add(slug);
        continue;
      }
      if (policy[kind] === 'skip') {
        entities.push({
          kind,
          archiveSlug: slug,
          finalSlug: slug,
          id: existing.get(slug) as string,
          action: 'skip',
        });
        continue;
      }
      const finalSlug = uniqueSlug(`${slug}-imported`, used);
      const id = idGen();
      entities.push({ kind, archiveSlug: slug, finalSlug, id, action: 'rename' });
      idBySlug[kind].set(slug, id);
      used.add(finalSlug);
    }
  }

  const assetIdBySlug = new Map<string, string>();
  for (const asset of archive.assets ?? []) {
    assetIdBySlug.set(asset.slug, idGen());
  }

  const applyCalendar = !ctx.targetHasCalendar && (archive.calendar?.eras.length ?? 0) > 0;

  const eraIdBySlug = new Map<string, string>();
  if (applyCalendar) {
    for (const era of archive.calendar?.eras ?? []) {
      eraIdBySlug.set(era.slug, idGen());
    }
  } else {
    for (const [slug, id] of ctx.existingEraIdBySlug) {
      eraIdBySlug.set(slug, id);
    }
  }

  return { entities, idBySlug, assetIdBySlug, eraIdBySlug, applyCalendar };
}

export function archiveEntitiesOf(
  archive: UniverseArchive,
  kind: EntityKind,
): readonly { slug: string }[] {
  switch (kind) {
    case 'character':
      return archive.characters ?? [];
    case 'place':
      return archive.places ?? [];
    case 'plotline':
      return archive.plotlines ?? [];
    case 'event':
      return archive.events ?? [];
    case 'codexEntry':
      return archive.codexEntries ?? [];
    case 'story':
      return archive.stories ?? [];
  }
}

export function blankKindMaps(): Record<EntityKind, Map<string, string>> {
  return {
    character: new Map(),
    place: new Map(),
    event: new Map(),
    story: new Map(),
    plotline: new Map(),
    codexEntry: new Map(),
  };
}

function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}
