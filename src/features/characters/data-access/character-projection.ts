import { DirectoryRowInputs } from '@shared/data-access';
import { Character } from './character.types';

/**
 * Pure projection-input builder for Character. Shared by
 * `CharactersService` (live writes) and `ProjectionRebuildService`
 * (chunked rebuilds). No DI handles — accepts the entity directly so
 * the same function works from a CLI / rebuild path.
 *
 * `secondary` (first-relatedRef resolved name) is intentionally
 * unpopulated in phase 1 — it requires a cross-kind directory lookup
 * that the resolver-cache wiring lands in phase 2.
 */
export function buildCharacterDirectoryInputs(entity: Character): DirectoryRowInputs {
  return {
    label: entity.name,
    coverAssetId: entity.coverAssetId,
  };
}
