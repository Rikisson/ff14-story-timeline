import { EntityRef } from '@shared/models';

export interface CodexEntry {
  id: string;
  slug: string;
  title: string;
  /**
   * Stable reference into `_meta/codex_categories[].key`. The canonical
   * target for category identity; chip color and label resolve via the
   * categories config (see `docs/narrative-engine-impl.md` *Codex
   * categories — Codex entries reference categoryKey only*).
   */
  categoryKey?: string;
  description: string;
  coverAssetId?: string;
  // Intentionally untyped across all EntityKinds — a codex entry can reference anything in the world.
  relatedRefs?: EntityRef[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredCodexEntry = Omit<CodexEntry, 'id'>;

export interface CodexEntryDraft {
  slug: string;
  title: string;
  categoryKey?: string;
  description: string;
  coverAssetId?: string;
  relatedRefs?: EntityRef[];
}
