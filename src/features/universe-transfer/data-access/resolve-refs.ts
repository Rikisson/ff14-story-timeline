import { EntityKind, EntityRef } from '@shared/models';
import { buildInlineRef, isRefSegment, parseRefs } from '@shared/utils';
import { ArchiveRef } from './archive-format';

export type KindSlugMap = Record<EntityKind, Map<string, string>>;

export function resolveArchiveRef<K extends EntityKind>(
  ref: ArchiveRef<K>,
  idBySlug: KindSlugMap,
): EntityRef<K> | null {
  const id = idBySlug[ref.kind].get(ref.ref);
  return id ? { kind: ref.kind, id } : null;
}

export function toArchiveRef<K extends EntityKind>(
  ref: EntityRef<K>,
  slugById: KindSlugMap,
): ArchiveRef<K> | null {
  const slug = slugById[ref.kind].get(ref.id);
  return slug ? { kind: ref.kind, ref: slug } : null;
}

export function rewriteInlineTokensToIds(text: string, idBySlug: KindSlugMap): string {
  return rewriteInlineTokens(text, (kind, key) => idBySlug[kind].get(key));
}

export function rewriteInlineTokensToSlugs(text: string, slugById: KindSlugMap): string {
  return rewriteInlineTokens(text, (kind, key) => slugById[kind].get(key));
}

function rewriteInlineTokens(
  text: string,
  lookup: (kind: EntityKind, key: string) => string | undefined,
): string {
  if (!text) return text;
  return parseRefs(text)
    .map((segment) => {
      if (!isRefSegment(segment)) return segment.literal;
      const resolved = lookup(segment.ref.kind, segment.ref.id);
      return resolved
        ? buildInlineRef(segment.ref.kind, resolved, segment.displayText)
        : segment.displayText;
    })
    .join('');
}
