import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { buildPlotlineDirectoryInputs } from './plotline-projection';
import { Plotline, PlotlineDraft } from './plotline.types';

@Injectable({ providedIn: 'root' })
export class PlotlinesService extends UniverseEntityService<Plotline, PlotlineDraft> {
  protected readonly collectionName = 'plotlines';
  protected readonly kind: EntityKind = 'plotline';

  protected toDirectoryInputs(entity: Plotline): DirectoryRowInputs {
    return buildPlotlineDirectoryInputs(entity);
  }
}
