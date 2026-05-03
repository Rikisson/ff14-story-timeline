import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseEntityService } from '@shared/data-access';
import { Plotline, PlotlineDraft } from './plotline.types';

@Injectable({ providedIn: 'root' })
export class PlotlinesService extends UniverseEntityService<Plotline, PlotlineDraft> {
  protected readonly collectionName = 'plotlines';
  protected readonly kind: EntityKind = 'plotline';

  readonly plotlines = this.entitiesSignal;
}
