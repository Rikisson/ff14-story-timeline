export interface CodexCategory {
  id: string;
  // Stable folded slug derived from the initial label. Optional during the
  // transition from the legacy label-as-identity config; required once the
  // category config writer per docs `narrative-engine-impl.md` *Codex
  // categories* lands.
  key?: string;
  label: string;
  color?: string;
  description?: string;
}

export interface CodexCategoriesConfig {
  categories: CodexCategory[];
  // Optimistic-concurrency token per docs `narrative-engine-impl.md` *Codex
  // categories — Config writes are transactional*. Optional during transition.
  version?: number;
  updatedAt?: number;
}

export const EMPTY_CODEX_CATEGORIES_CONFIG: CodexCategoriesConfig = { categories: [] };

/**
 * Raised when a folded label or stable key would collide with another
 * category's folded label or key within the same universe. The conflict
 * field names the colliding category and value so the UI can surface a
 * specific message like *Conflicts with "Items — Equipment"*.
 */
export class CategoryConflictError extends Error {
  constructor(
    public readonly existing: CodexCategory,
    public readonly value: string,
  ) {
    super(`Folded value "${value}" conflicts with category "${existing.label}".`);
    this.name = 'CategoryConflictError';
  }
}

/**
 * Raised when a delete is attempted on a category that still has codex
 * entries referencing it via `categoryKey`. The settings UI surfaces the
 * count and offers a reassign-or-remove flow before re-attempting.
 */
export class CategoryInUseError extends Error {
  constructor(
    public readonly category: CodexCategory,
    public readonly usageCount: number,
  ) {
    super(
      `Category "${category.label}" is referenced by ${usageCount} codex ` +
        `${usageCount === 1 ? 'entry' : 'entries'}; reassign or remove them first.`,
    );
    this.name = 'CategoryInUseError';
  }
}

/**
 * Raised when an attempt to rename a category targets a stable `key` that
 * the caller is implicitly trying to change. Keys are immutable after
 * creation; the rename must preserve the existing key.
 */
export class CategoryKeyImmutableError extends Error {
  constructor(public readonly id: string, public readonly attemptedKey: string) {
    super(`Cannot change immutable key on category ${id} to "${attemptedKey}".`);
    this.name = 'CategoryKeyImmutableError';
  }
}

/**
 * Raised when a bulk `save` is attempted against a config doc whose
 * version no longer matches the caller's last-seen version. The settings
 * panel must re-pull the config and the author must redo their edit;
 * blindly retrying with the stale draft would drop concurrent
 * additions. See `CodexCategoriesService.save` for the OCC contract.
 */
export class StaleCategoriesError extends Error {
  constructor(
    public readonly currentVersion: number,
    public readonly expectedVersion: number,
  ) {
    super(
      `Codex categories changed elsewhere (expected v${expectedVersion}, got v${currentVersion}). Reload to see the latest list.`,
    );
    this.name = 'StaleCategoriesError';
  }
}
