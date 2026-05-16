import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  Signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  Transaction,
  where,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { foldLabel } from '@shared/utils';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  CategoryConflictError,
  CategoryInUseError,
  CategoryKeyImmutableError,
  CodexCategoriesConfig,
  CodexCategory,
  EMPTY_CODEX_CATEGORIES_CONFIG,
} from './codex-category.types';

const CONFIG_DOC = 'codex_categories';
const CODEX_ENTRIES = 'codexEntries';

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

export interface CodexCategoryDraft {
  label: string;
  color?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class CodexCategoriesService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _config = signal<CodexCategoriesConfig>(EMPTY_CODEX_CATEGORIES_CONFIG);
  readonly config: Signal<CodexCategoriesConfig> = this._config.asReadonly();
  readonly categories = computed<CodexCategory[]>(() => this._config().categories);

  /**
   * Lookup by stable `key`. The canonical path for resolving chip colour
   * and label from a codex entry's `categoryKey` per docs
   * `narrative-engine-impl.md` *Codex categories — Codex entries reference
   * categoryKey only*.
   */
  readonly categoryByKey = computed<Map<string, CodexCategory>>(() => {
    const map = new Map<string, CodexCategory>();
    for (const c of this._config().categories) {
      if (c.key) map.set(c.key, c);
    }
    return map;
  });

  /**
   * Legacy lookup by case-insensitive label, kept while consuming code
   * transitions from the legacy `category: string` field on entries to
   * `categoryKey`. Phase 2 removes this in favour of `categoryByKey`.
   */
  readonly categoryByLabel = computed<Map<string, CodexCategory>>(() => {
    const map = new Map<string, CodexCategory>();
    for (const c of this._config().categories) map.set(c.label.toLowerCase(), c);
    return map;
  });

  private readonly _refreshError = signal<string | null>(null);
  readonly refreshError: Signal<string | null> = this._refreshError.asReadonly();

  private refreshSeq = 0;

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._config.set(EMPTY_CODEX_CATEGORIES_CONFIG);
          this._refreshError.set(null);
          return;
        }
        this._refreshError.set(null);
        this.refresh(id).catch((err) => {
          console.error('codex categories refresh failed', err);
          this._refreshError.set(errorMessage(err));
        });
      });
    }
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    const seq = ++this.refreshSeq;
    if (!id) {
      this._config.set(EMPTY_CODEX_CATEGORIES_CONFIG);
      return;
    }
    const ref = doc(this.firebase.firestore, 'universes', id, '_meta', CONFIG_DOC);
    const snap = await getDoc(ref);
    if (seq !== this.refreshSeq) return;
    this._config.set(
      snap.exists() ? (snap.data() as CodexCategoriesConfig) : EMPTY_CODEX_CATEGORIES_CONFIG,
    );
  }

  /**
   * Bulk-save the full categories list. Used by the settings panel.
   * Runs in `runTransaction` so concurrent settings sessions can't
   * silently overwrite each other; validates folded-label/key uniqueness
   * across the final list, generates `key` for any entries that don't
   * have one yet, and enforces key immutability on existing entries.
   *
   * Categories removed by this save must have zero codex entries
   * referencing them — checked via a pre-transaction `where categoryKey
   * == removed.key` query per removed category. A race with concurrent
   * codex entry creation can produce an orphan `categoryKey`; per
   * `docs/backend-rules.md` *Write discipline*, that's a recoverable bug,
   * not a data integrity violation.
   */
  async save(next: CodexCategoriesConfig): Promise<void> {
    const universeId = this.requireUniverseId();
    const removedKeys = await this.computeRemovedKeys(universeId, next);
    for (const removed of removedKeys) {
      await this.assertCategoryNotInUse(universeId, removed);
    }
    await runTransaction(this.firebase.firestore, async (tx) => {
      const current = await readConfig(tx, this.firebase.firestore, universeId);
      const finalised = finaliseSave(current, next);
      writeConfig(tx, this.firebase.firestore, universeId, finalised);
    });
    await this.refresh(universeId);
  }

  /** Create a single category transactionally. Returns the persisted row. */
  async createCategory(input: CodexCategoryDraft): Promise<CodexCategory> {
    const universeId = this.requireUniverseId();
    const created = await runTransaction(this.firebase.firestore, (tx) =>
      applyCategoryCreate(tx, this.firebase.firestore, universeId, input),
    );
    await this.refresh(universeId);
    return created;
  }

  /** Rename / recolour / re-describe a category. `key` cannot change. */
  async renameCategory(
    id: string,
    patch: Partial<Pick<CodexCategory, 'label' | 'color' | 'description'>>,
  ): Promise<void> {
    const universeId = this.requireUniverseId();
    await runTransaction(this.firebase.firestore, (tx) =>
      applyCategoryRename(tx, this.firebase.firestore, universeId, id, patch),
    );
    await this.refresh(universeId);
  }

  /**
   * Delete a category. Throws `CategoryInUseError` if any codex entry
   * still references it (non-transactional pre-check, see `save` for
   * the race caveat).
   */
  async deleteCategory(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    const cat = this._config().categories.find((c) => c.id === id);
    if (cat?.key) await this.assertCategoryNotInUse(universeId, cat.key);
    await runTransaction(this.firebase.firestore, (tx) =>
      applyCategoryDelete(tx, this.firebase.firestore, universeId, id),
    );
    await this.refresh(universeId);
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }

  private async computeRemovedKeys(
    universeId: string,
    next: CodexCategoriesConfig,
  ): Promise<string[]> {
    const ref = doc(this.firebase.firestore, 'universes', universeId, '_meta', CONFIG_DOC);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const current = (snap.data() as CodexCategoriesConfig).categories ?? [];
    const nextIds = new Set(next.categories.map((c) => c.id));
    return current.filter((c) => !nextIds.has(c.id) && !!c.key).map((c) => c.key!);
  }

  private async assertCategoryNotInUse(universeId: string, key: string): Promise<void> {
    const q = query(
      collection(this.firebase.firestore, 'universes', universeId, CODEX_ENTRIES),
      where('categoryKey', '==', key),
      limit(1),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const blocker = this._config().categories.find((c) => c.key === key);
      throw new CategoryInUseError(
        blocker ?? { id: key, label: key },
        snap.size,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Pure transaction-body helpers — exported for compose with the codex-entry
// auto-create flow (per docs `narrative-engine-impl.md` *Codex categories —
// auto-create*: the typeahead's *Create category "X"* path runs category
// creation and codex-entry creation inside one `runTransaction`).
// ---------------------------------------------------------------------------

export async function applyCategoryCreate(
  tx: Transaction,
  firestore: Firestore,
  universeId: string,
  input: CodexCategoryDraft,
): Promise<CodexCategory> {
  const current = await readConfig(tx, firestore, universeId);
  const created: CodexCategory = {
    id: crypto.randomUUID(),
    key: foldLabel(input.label),
    label: input.label.trim(),
    color: input.color,
    description: input.description,
  };
  if (!created.label) throw new Error('Category label cannot be empty.');
  if (!created.key) throw new Error('Category label folds to an empty key.');
  assertNoConflict(current.categories, created);
  const next: CodexCategoriesConfig = {
    ...current,
    categories: [...current.categories, created],
    version: (current.version ?? 0) + 1,
    updatedAt: Date.now(),
  };
  writeConfig(tx, firestore, universeId, next);
  return created;
}

export async function applyCategoryRename(
  tx: Transaction,
  firestore: Firestore,
  universeId: string,
  id: string,
  patch: Partial<Pick<CodexCategory, 'label' | 'color' | 'description'>>,
): Promise<void> {
  const current = await readConfig(tx, firestore, universeId);
  const idx = current.categories.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`Category ${id} not found.`);
  const existing = current.categories[idx];
  const renamed: CodexCategory = {
    ...existing,
    ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
    ...(patch.color !== undefined ? { color: patch.color } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
  };
  if (!renamed.label) throw new Error('Category label cannot be empty.');
  if (existing.key && renamed.key !== existing.key) {
    throw new CategoryKeyImmutableError(id, renamed.key ?? '');
  }
  // Key stays the existing key; nothing else folds.
  assertNoConflict(current.categories, renamed, existing.id);
  const nextCategories = [...current.categories];
  nextCategories[idx] = renamed;
  writeConfig(tx, firestore, universeId, {
    ...current,
    categories: nextCategories,
    version: (current.version ?? 0) + 1,
    updatedAt: Date.now(),
  });
}

export async function applyCategoryDelete(
  tx: Transaction,
  firestore: Firestore,
  universeId: string,
  id: string,
): Promise<void> {
  const current = await readConfig(tx, firestore, universeId);
  const next = current.categories.filter((c) => c.id !== id);
  if (next.length === current.categories.length) return;
  writeConfig(tx, firestore, universeId, {
    ...current,
    categories: next,
    version: (current.version ?? 0) + 1,
    updatedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function readConfig(
  tx: Transaction,
  firestore: Firestore,
  universeId: string,
): Promise<CodexCategoriesConfig> {
  const ref = doc(firestore, 'universes', universeId, '_meta', CONFIG_DOC);
  const snap = await tx.get(ref);
  return snap.exists() ? (snap.data() as CodexCategoriesConfig) : EMPTY_CODEX_CATEGORIES_CONFIG;
}

function writeConfig(
  tx: Transaction,
  firestore: Firestore,
  universeId: string,
  next: CodexCategoriesConfig,
): void {
  const ref = doc(firestore, 'universes', universeId, '_meta', CONFIG_DOC);
  tx.set(ref, next);
}

/**
 * Bulk-save reconciliation: preserves existing keys, generates keys for
 * brand-new entries, validates uniqueness across the final list, and
 * bumps the version.
 */
export function finaliseSave(
  current: CodexCategoriesConfig,
  next: CodexCategoriesConfig,
): CodexCategoriesConfig {
  const existingById = new Map(current.categories.map((c) => [c.id, c]));
  const reconciled: CodexCategory[] = next.categories.map((incoming) => {
    const existing = existingById.get(incoming.id);
    const trimmedLabel = (incoming.label ?? '').trim();
    if (!trimmedLabel) {
      throw new Error('Category label cannot be empty.');
    }
    if (existing) {
      if (existing.key && incoming.key && incoming.key !== existing.key) {
        throw new CategoryKeyImmutableError(existing.id, incoming.key);
      }
      return {
        ...existing,
        ...incoming,
        key: existing.key ?? incoming.key ?? foldLabel(trimmedLabel),
        label: trimmedLabel,
      };
    }
    const generatedKey = incoming.key ?? foldLabel(trimmedLabel);
    if (!generatedKey) throw new Error('Category label folds to an empty key.');
    return { ...incoming, label: trimmedLabel, key: generatedKey };
  });
  for (let i = 0; i < reconciled.length; i++) {
    assertNoConflict(reconciled.slice(0, i), reconciled[i]);
  }
  return {
    ...current,
    ...next,
    categories: reconciled,
    version: (current.version ?? 0) + 1,
    updatedAt: Date.now(),
  };
}

/**
 * Folded uniqueness: for every other category in `pool`, neither its
 * folded label nor its stable key may coincide with the candidate's
 * folded label or key. Pass `excludeId` when re-validating a rename so
 * the category doesn't conflict with itself.
 */
function assertNoConflict(
  pool: CodexCategory[],
  candidate: CodexCategory,
  excludeId?: string,
): void {
  const claims = new Set<string>();
  const folded = foldLabel(candidate.label);
  if (folded) claims.add(folded);
  if (candidate.key) claims.add(candidate.key);
  for (const other of pool) {
    if (other.id === candidate.id || other.id === excludeId) continue;
    const otherFolded = foldLabel(other.label);
    if (otherFolded && claims.has(otherFolded)) {
      throw new CategoryConflictError(other, otherFolded);
    }
    if (other.key && claims.has(other.key)) {
      throw new CategoryConflictError(other, other.key);
    }
  }
}
