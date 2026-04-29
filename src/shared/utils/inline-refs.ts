import { EntityKind, EntityRef } from '@shared/models';

export type InlineRefKindPrefix = 'ch' | 'pl' | 'ev' | 'st';

export const INLINE_REF_KIND_BY_PREFIX: Record<InlineRefKindPrefix, EntityKind> = {
  ch: 'character',
  pl: 'place',
  ev: 'event',
  st: 'story',
};

export const INLINE_REF_PREFIX_BY_KIND: Record<EntityKind, InlineRefKindPrefix> = {
  character: 'ch',
  place: 'pl',
  event: 'ev',
  story: 'st',
};

export const INLINE_REF_REGEX = /\$\{(ch|pl|ev|st):([A-Za-z0-9_-]+)\}\[([^\]]*)\]/g;

export interface RefSegment {
  ref: EntityRef;
  displayText: string;
  raw: string;
}

export interface LiteralSegment {
  literal: string;
}

export type Segment = LiteralSegment | RefSegment;

export function isRefSegment(segment: Segment): segment is RefSegment {
  return (segment as RefSegment).ref !== undefined;
}

export function parseRefs(text: string): Segment[] {
  if (!text) return [];
  const segments: Segment[] = [];
  const re = new RegExp(INLINE_REF_REGEX.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const [raw, prefix, id, displayText] = match;
    if (match.index > lastIndex) {
      segments.push({ literal: text.slice(lastIndex, match.index) });
    }
    segments.push({
      ref: { kind: INLINE_REF_KIND_BY_PREFIX[prefix as InlineRefKindPrefix], id },
      displayText,
      raw,
    });
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    segments.push({ literal: text.slice(lastIndex) });
  }
  return segments;
}

export function buildInlineRef(
  kind: EntityKind,
  id: string,
  displayText: string = '',
): string {
  return `\${${INLINE_REF_PREFIX_BY_KIND[kind]}:${id}}[${displayText}]`;
}

export interface InlineRefLookup {
  resolve(ref: EntityRef): string | undefined;
}

export function resolveRef(
  ref: EntityRef,
  lookup: InlineRefLookup | ((ref: EntityRef) => string | undefined),
): string | undefined {
  return typeof lookup === 'function' ? lookup(ref) : lookup.resolve(ref);
}
