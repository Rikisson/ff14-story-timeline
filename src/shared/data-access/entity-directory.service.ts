import { inject, Injectable } from '@angular/core';
import {
  collection,
  documentId,
  endAt,
  getDocs,
  limit,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  startAt,
  where,
} from 'firebase/firestore/lite';
import { EntityKind, EntityRef } from '@shared/models';
import { foldLabel } from '@shared/utils';
import { FirebaseService } from '../../app/firebase/firebase.service';
import { ResolvedDirectoryRow } from './entity-resolver-cache.service';

const DIRECTORY_COLLECTION = '_directory';
const HIGH_CODEPOINT_SENTINEL = '';
const DEFAULT_PREFIX_LIMIT = 20;
const FIRESTORE_IN_CHUNK = 30;

export interface PrefixSearchOptions {
  universeId: string;
  /** Free-text query. Folded via `foldLabel` before the prefix scan. */
  query: string;
  /** Restrict results to a single entity kind. */
  kind?: EntityKind;
  /** Members may include draft rows; public callers must leave this off. */
  includeDrafts?: boolean;
  /** Defaults to 20 per `docs/backend-rules.md` *Directory projection*. */
  limit?: number;
}

export interface ByKindOptions {
  universeId: string;
  kind: EntityKind;
  includeDrafts?: boolean;
  limit?: number;
  cursor?: QueryDocumentSnapshot;
}

export interface ByKindResult {
  rows: ResolvedDirectoryRow[];
  nextCursor: QueryDocumentSnapshot | null;
}

/**
 * Read primitives over the `_directory` projection. No caching, no
 * subscribers — this is the layer pickers, inline-ref suggestion
 * popups, and authoring lists call into. For chip / hover-card / inline
 * label resolution, prefer `EntityResolverCache` so repeated reads of
 * the same ref are deduped session-wide.
 *
 * Prefix search uses `labelFolded` + `startAt(q) / endAt(q + '')`
 * per `docs/backend-rules.md` *Directory projection*. Indexes for
 * `(visiblePublic, kind, labelFolded)`, `(visiblePublic, labelFolded)`,
 * and `(kind, labelFolded)` are authored in `firestore.indexes.json`.
 */
@Injectable({ providedIn: 'root' })
export class EntityDirectoryService {
  private readonly firebase = inject(FirebaseService);

  async prefixSearch(opts: PrefixSearchOptions): Promise<ResolvedDirectoryRow[]> {
    const folded = foldLabel(opts.query);
    const constraints: QueryConstraint[] = [];
    if (!opts.includeDrafts) constraints.push(where('visiblePublic', '==', true));
    if (opts.kind) constraints.push(where('kind', '==', opts.kind));
    constraints.push(orderBy('labelFolded'));
    if (folded) {
      constraints.push(startAt(folded), endAt(folded + HIGH_CODEPOINT_SENTINEL));
    }
    constraints.push(limit(opts.limit ?? DEFAULT_PREFIX_LIMIT));
    const q = query(this.directoryRef(opts.universeId), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => projectRow(d.data() as RawDirectoryRow));
  }

  async byKind(opts: ByKindOptions): Promise<ByKindResult> {
    const constraints: QueryConstraint[] = [];
    if (!opts.includeDrafts) constraints.push(where('visiblePublic', '==', true));
    constraints.push(where('kind', '==', opts.kind));
    constraints.push(orderBy('labelFolded'));
    if (opts.cursor) constraints.push(startAfter(opts.cursor));
    constraints.push(limit(opts.limit ?? DEFAULT_PREFIX_LIMIT));
    const q = query(this.directoryRef(opts.universeId), ...constraints);
    const snap = await getDocs(q);
    return {
      rows: snap.docs.map((d) => projectRow(d.data() as RawDirectoryRow)),
      nextCursor: snap.docs.length === (opts.limit ?? DEFAULT_PREFIX_LIMIT)
        ? snap.docs[snap.docs.length - 1]
        : null,
    };
  }

  /**
   * One-shot batched fetch of N refs without going through
   * `EntityResolverCache`. Use this for non-render paths (e.g.
   * pre-publish validation) where caching would only pollute the
   * resolver's session map.
   */
  async byIds(opts: { universeId: string; refs: readonly EntityRef[] }): Promise<ResolvedDirectoryRow[]> {
    const rowKeys = opts.refs.map((r) => `${r.kind}_${r.id}`);
    if (rowKeys.length === 0) return [];
    const out: ResolvedDirectoryRow[] = [];
    for (let i = 0; i < rowKeys.length; i += FIRESTORE_IN_CHUNK) {
      const chunk = rowKeys.slice(i, i + FIRESTORE_IN_CHUNK);
      const q = query(
        this.directoryRef(opts.universeId),
        where(documentId(), 'in', chunk),
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) out.push(projectRow(d.data() as RawDirectoryRow));
    }
    return out;
  }

  private directoryRef(universeId: string) {
    return collection(this.firebase.firestore, 'universes', universeId, DIRECTORY_COLLECTION);
  }
}

interface RawDirectoryRow {
  kind: EntityKind;
  entityId: string;
  label: string;
  slug: string;
  coverAssetId?: string;
  secondary?: string;
  categoryKey?: string;
  status?: string;
  draft?: boolean;
}

function projectRow(raw: RawDirectoryRow): ResolvedDirectoryRow {
  return {
    kind: raw.kind,
    id: raw.entityId,
    label: raw.label,
    slug: raw.slug,
    coverAssetId: raw.coverAssetId,
    secondary: raw.secondary,
    categoryKey: raw.categoryKey,
    status: raw.status,
    draft: raw.draft,
  };
}
