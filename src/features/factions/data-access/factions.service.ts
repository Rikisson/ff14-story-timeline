import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseEntityService } from '@shared/data-access';
import { Faction, FactionDraft } from './faction.types';

@Injectable({ providedIn: 'root' })
export class FactionsService extends UniverseEntityService<Faction, FactionDraft> {
  protected readonly collectionName = 'factions';
  protected readonly kind: EntityKind = 'faction';

  readonly factions = this.entitiesSignal;
}
