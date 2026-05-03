import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseEntityService } from '@shared/data-access';
import { TimelineEvent, TimelineEventDraft } from './event.types';

@Injectable({ providedIn: 'root' })
export class EventsService extends UniverseEntityService<TimelineEvent, TimelineEventDraft> {
  protected readonly collectionName = 'events';
  protected readonly kind: EntityKind = 'event';

  readonly events = this.entitiesSignal;
}
