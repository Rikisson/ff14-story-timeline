import { DirectoryRowInputs } from '@shared/data-access';
import { Plotline, PLOTLINE_STATUS_LABEL } from './plotline.types';

/**
 * Pure projection-input builder for Plotline. Shared by
 * `PlotlinesService` (live writes) and `ProjectionRebuildService`
 * (chunked rebuilds).
 */
export function buildPlotlineDirectoryInputs(entity: Plotline): DirectoryRowInputs {
  return {
    label: entity.title,
    coverAssetId: entity.coverAssetId,
    status: entity.status,
    secondary: entity.status ? PLOTLINE_STATUS_LABEL[entity.status] : undefined,
  };
}
