import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseEntityService } from '@shared/data-access';
import { Item, ItemDraft } from './item.types';

@Injectable({ providedIn: 'root' })
export class ItemsService extends UniverseEntityService<Item, ItemDraft> {
  protected readonly collectionName = 'items';
  protected readonly kind: EntityKind = 'item';

  readonly items = this.entitiesSignal;
}
