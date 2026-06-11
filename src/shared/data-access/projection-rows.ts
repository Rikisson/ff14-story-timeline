import { EntityKind, InGameDate } from '@shared/models';
import { CanonicalisableValue, computeSourceFingerprint, foldLabel } from '@shared/utils';

/**
 * Pure projection-row construction. Shared by:
 *
 *   - `applyEntityWrite` (live writes inside a transaction)
 *   - `ProjectionRebuildService` (client-side chunked rebuild on
 *     calendar config changes and category renames)
 *   - `scripts/rebuild-projections.mjs` (CLI ops recovery — duplicated
 *     in plain JS because the CLI runs without a TS transpiler)
 *
 * The CLI's inlined algorithm must stay in lockstep with this module.
 * If you change the row shape or fingerprint algorithm here, mirror the
 * change in the CLI script and bump its header reference comment.
 */

export interface DirectoryRowInputs {
  label: string;
  labelFolded?: string;
  coverAssetId?: string;
  secondary?: string;
  categoryKey?: string;
  status?: string;
  draft?: boolean;
}

export interface TimelineRowInputs {
  title: string;
  coverAssetId?: string;
  inGameDate: InGameDate;
  dateSortKey: string;
  dateKnown: boolean;
  plotlineIds: string[];
  characterIds: string[];
  placeIds: string[];
}

export interface ProjectionRowsInputs {
  kind: EntityKind;
  id: string;
  slug: string;
  directory: DirectoryRowInputs;
  /** Only story / event kinds populate this. */
  timeline?: TimelineRowInputs;
}

export interface BuiltProjectionRows {
  /** Combined fingerprint over the directory + timeline slices, used by drift detection. */
  fingerprint: string;
  /** `_directory/{kind}_{id}` row. */
  directoryRow: Record<string, unknown>;
  /** `_timelineEntries/{kind}_{id}` row. `null` for non-timeline kinds. */
  timelineRow: Record<string, unknown> | null;
}

export async function buildProjectionRows(
  input: ProjectionRowsInputs,
  updatedAt: number,
): Promise<BuiltProjectionRows> {
  const { kind, id, slug, directory, timeline } = input;
  const labelFolded = directory.labelFolded ?? foldLabel(directory.label);
  const visiblePublic = directory.draft !== true;

  const directoryRow: Record<string, unknown> = {
    kind,
    entityId: id,
    label: directory.label,
    labelFolded,
    slug,
    visiblePublic,
  };
  setIfDefined(directoryRow, 'coverAssetId', directory.coverAssetId);
  setIfDefined(directoryRow, 'secondary', directory.secondary);
  setIfDefined(directoryRow, 'categoryKey', directory.categoryKey);
  setIfDefined(directoryRow, 'status', directory.status);
  setIfDefined(directoryRow, 'draft', directory.draft);

  let timelineRow: Record<string, unknown> | null = null;
  if (timeline) {
    timelineRow = {
      kind,
      entityId: id,
      title: timeline.title,
      inGameDate: timeline.inGameDate,
      dateSortKey: timeline.dateSortKey,
      dateKnown: timeline.dateKnown,
      plotlineIds: timeline.plotlineIds,
      characterIds: timeline.characterIds,
      placeIds: timeline.placeIds,
      draft: directory.draft === true,
      visiblePublic,
    };
    setIfDefined(timelineRow, 'coverAssetId', timeline.coverAssetId);
  }

  const fingerprint = await computeSourceFingerprint({
    directory: directoryRow as CanonicalisableValue,
    timeline: (timelineRow ?? null) as CanonicalisableValue,
  });

  directoryRow['sourceFingerprint'] = fingerprint;
  directoryRow['updatedAt'] = updatedAt;
  if (timelineRow) {
    timelineRow['sourceFingerprint'] = fingerprint;
    timelineRow['updatedAt'] = updatedAt;
  }

  return { fingerprint, directoryRow, timelineRow };
}

/**
 * Composite key used by `_directory/{kind}_{id}` AND
 * `_timelineEntries/{kind}_{id}`. The two collections share the same
 * row-key shape.
 */
export function entityRowKey(kind: EntityKind, id: string): string {
  return `${kind}_${id}`;
}

export function slugRowKey(kind: EntityKind, slug: string): string {
  return `${kind}_${slug}`;
}

function setIfDefined<K extends string>(
  obj: Record<string, unknown>,
  key: K,
  value: unknown,
): void {
  if (value !== undefined) obj[key] = value;
}
