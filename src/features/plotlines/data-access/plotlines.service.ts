import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { Plotline, PLOTLINE_STATUS_LABEL, PlotlineDraft } from './plotline.types';

@Injectable({ providedIn: 'root' })
export class PlotlinesService extends UniverseEntityService<Plotline, PlotlineDraft> {
  protected readonly collectionName = 'plotlines';
  protected readonly kind: EntityKind = 'plotline';

  readonly plotlines = this.entitiesSignal;

  protected toDirectoryInputs(entity: Plotline): DirectoryRowInputs {
    return {
      label: entity.title,
      coverAssetId: entity.coverAssetId,
      status: entity.status,
      secondary: entity.status ? PLOTLINE_STATUS_LABEL[entity.status] : undefined,
    };
  }
}
