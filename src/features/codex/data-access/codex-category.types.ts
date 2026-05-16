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
