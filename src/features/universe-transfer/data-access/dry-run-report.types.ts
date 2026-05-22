import { EntityKind } from '@shared/models';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  path: string;
  message: string;
  hint?: string;
}

export type ConflictResolution = 'skip' | 'rename';

export interface KindSummary {
  kind: EntityKind;
  incoming: number;
  collisions: number;
}

export interface AssetSummary {
  total: number;
  withBinary: number;
  missingBinary: number;
  totalBytes: number;
}

export interface ConfigPlan {
  applyCalendar: boolean;
  packageCalendarEras: number;
  newCategoryKeys: string[];
  existingCategoryKeys: string[];
}

export interface DryRunReport {
  ok: boolean;
  formatVersion: number;
  generator?: string;
  sourceUniverseName?: string;
  kinds: KindSummary[];
  assets: AssetSummary;
  config: ConfigPlan;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

export interface RenamedEntity {
  kind: EntityKind;
  from: string;
  to: string;
}

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  renamed: RenamedEntity[];
  failed: number;
  assetsUploaded: number;
  assetsFailed: number;
  calendarApplied: boolean;
  categoriesAdded: number;
}
