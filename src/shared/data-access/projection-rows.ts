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
  /**
   * `_timelineLaneEntries/{laneKey}_{kind}_{id}` rows. Empty for
   * non-timeline kinds. For timeline kinds with no plotline refs, this
   * carries a single row keyed by `__unassigned__`.
   */
  laneRows: Array<{ laneKey: string; rowKey: string; row: Record<string, unknown> }>;
}

export const UNASSIGNED_LANE_KEY = '__unassigned__';

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
  let laneIds: string[] = [];
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
    laneIds = laneIdsOf(timeline.plotlineIds);
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

  const laneRows = timelineRow
    ? laneIds.map((laneKey) => ({
        laneKey,
        rowKey: `${laneKey}_${kind}_${id}`,
        row: { ...timelineRow, laneKey },
      }))
    : [];

  return { fingerprint, directoryRow, timelineRow, laneRows };
}

export function directoryRowKey(kind: EntityKind, id: string): string {
  return `${kind}_${id}`;
}

export function timelineRowKey(kind: EntityKind, id: string): string {
  return `${kind}_${id}`;
}

export function slugRowKey(kind: EntityKind, slug: string): string {
  return `${kind}_${slug}`;
}

export function laneIdsOf(plotlineIds: readonly string[]): string[] {
  return plotlineIds.length === 0 ? [UNASSIGNED_LANE_KEY] : [...plotlineIds];
}

function setIfDefined<K extends string>(
  obj: Record<string, unknown>,
  key: K,
  value: unknown,
): void {
  if (value !== undefined) obj[key] = value;
}
