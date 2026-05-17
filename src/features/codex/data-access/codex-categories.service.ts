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
  StaleCategoriesError,
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
   * The OCC check compares `expectedVersion` (the caller's last-seen
   * config version) against the version read inside the transaction.
   * Mismatch throws `StaleCategoriesError`; the panel must re-pull, the
   * author must redo their edit. Without this the retry-on-write-conflict
   * built into `runTransaction` only protects the doc write, not the
   * caller's stale draft — a concurrent additive edit would be silently
   * dropped when the loser's `next` overwrote the winner's categories.
   *
   * Categories removed by this save must have zero codex entries
   * referencing them — checked via a pre-transaction
   * `where categoryKey == removed.key` query per removed category. A
   * race with concurrent codex entry creation can produce an orphan
   * `categoryKey`; per `docs/backend-rules.md` *Write discipline*
   * that's a recoverable bug, not a data integrity violation.
   */
  /**
   * Stand-alone category create. Used by the codex-entry typeahead's
   * affirmative *Create category "X"* row. Runs `applyCategoryCreate`
   * inside its own `runTransaction` so concurrent creates can't bypass
   * the folded-label/key uniqueness check.
   *
   * The codex-entry write happens separately — a transient orphan window
   * exists if the user abandons the form after this resolves, which the
   * unused-category cleanup can drain later. See *Codex categories —
   * Every saved entry's `categoryKey` exists in config* in
   * `narrative-engine-impl.md`.
   */
  async createCategory(input: CodexCategoryDraft): Promise<CodexCategory> {
    const universeId = this.requireUniverseId();
    const created = await runTransaction(this.firebase.firestore, async (tx) => {
      return applyCategoryCreate(tx, this.firebase.firestore, universeId, input);
    });
    await this.refresh(universeId);
    return created;
  }

  async save(next: CodexCategoriesConfig, expectedVersion: number): Promise<void> {
    const universeId = this.requireUniverseId();
    const removedKeys = await this.computeRemovedKeys(universeId, next);
    for (const removed of removedKeys) {
      await this.assertCategoryNotInUse(universeId, removed);
    }
    await runTransaction(this.firebase.firestore, async (tx) => {
      const current = await readConfig(tx, this.firebase.firestore, universeId);
      const currentVersion = current.version ?? 0;
      if (currentVersion !== expectedVersion) {
        throw new StaleCategoriesError(currentVersion, expectedVersion);
      }
      const finalised = finaliseSave(current, next);
      writeConfig(tx, this.firebase.firestore, universeId, finalised);
    });
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
    if (snap.empty) return;
    const blocker = this._config().categories.find((c) => c.key === key);
    if (!blocker) {
      throw new Error(
        `Category with key "${key}" is referenced by codex entries but is not in the current config.`,
      );
    }
    throw new CategoryInUseError(blocker, snap.size);
  }
}

// ---------------------------------------------------------------------------
// Pure transaction-body helpers. `applyCategoryCreate` is the composable
// primitive that the codex-entry auto-create flow will call inside its
// own `runTransaction` (per `docs/narrative-engine-impl.md`
// *Codex categories — auto-create*: typeahead's *Create category "X"*
// row creates the config entry and the codex entry in one transaction).
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
