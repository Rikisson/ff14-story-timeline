import { DirectoryRowInputs } from '@shared/data-access';
import { CodexEntry } from './codex-entry.types';

/**
 * Categories context passed to projection builders. Decouples the pure
 * builder from `CodexCategoriesService`'s Angular DI so the same code
 * runs inside the live write path, the rebuild service (notably the
 * `rebuildForCategoryRename` path), and the CLI.
 */
export interface CodexCategoriesProjectionContext {
  categoryLabelByKey: ReadonlyMap<string, string>;
}

/**
 * Pure projection-input builder for CodexEntry. Shared by
 * `CodexEntriesService` (live writes) and `ProjectionRebuildService`
 * (chunked rebuilds on category renames — per
 * `docs/backend-rules.md` *Write discipline*).
 */
export function buildCodexEntryDirectoryInputs(
  entity: CodexEntry,
  ctx: CodexCategoriesProjectionContext,
): DirectoryRowInputs {
  return {
    label: entity.title,
    coverAssetId: entity.coverAssetId,
    categoryKey: entity.categoryKey,
    secondary: entity.categoryKey ? ctx.categoryLabelByKey.get(entity.categoryKey) : undefined,
  };
}
