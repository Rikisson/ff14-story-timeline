import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { buildPlaceDirectoryInputs } from './place-projection';
import { Place, PlaceDraft } from './place.types';

@Injectable({ providedIn: 'root' })
export class PlacesService extends UniverseEntityService<Place, PlaceDraft> {
  protected readonly collectionName = 'places';
  protected readonly kind: EntityKind = 'place';

  protected toDirectoryInputs(entity: Place): DirectoryRowInputs {
    return buildPlaceDirectoryInputs(entity);
  }
}
