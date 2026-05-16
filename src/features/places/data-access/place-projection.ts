import { DirectoryRowInputs } from '@shared/data-access';
import { Place } from './place.types';

/**
 * Pure projection-input builder for Place. Shared by `PlacesService`
 * (live writes) and `ProjectionRebuildService` (chunked rebuilds).
 *
 * `secondary` (first-relatedRef resolved name) is deferred to phase 2.
 */
export function buildPlaceDirectoryInputs(entity: Place): DirectoryRowInputs {
  return {
    label: entity.name,
    coverAssetId: entity.coverAssetId,
  };
}
