import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { Place, PlaceDraft } from './place.types';

@Injectable({ providedIn: 'root' })
export class PlacesService extends UniverseEntityService<Place, PlaceDraft> {
  protected readonly collectionName = 'places';
  protected readonly kind: EntityKind = 'place';

  readonly places = this.entitiesSignal;

  protected toDirectoryInputs(entity: Place): DirectoryRowInputs {
    return {
      label: entity.name,
      coverAssetId: entity.coverAssetId,
      // `secondary` (first-relatedRef resolved name) is deferred to phase 2
      // once `EntityResolverCache` is wired through the entity-write path.
    };
  }
}
