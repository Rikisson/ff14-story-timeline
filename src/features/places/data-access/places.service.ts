import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseEntityService } from '@shared/data-access';
import { Place, PlaceDraft } from './place.types';

@Injectable({ providedIn: 'root' })
export class PlacesService extends UniverseEntityService<Place, PlaceDraft> {
  protected readonly collectionName = 'places';
  protected readonly kind: EntityKind = 'place';

  readonly places = this.entitiesSignal;
}
