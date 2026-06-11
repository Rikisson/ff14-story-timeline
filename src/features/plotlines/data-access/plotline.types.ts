import { EntityRef } from '@shared/models';

export type PlotlineStatus = 'planned' | 'active' | 'resolved';

export const PLOTLINE_STATUS_LABEL: Record<PlotlineStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  resolved: 'Resolved',
};

export const PLOTLINE_MEMBERS_MAX = 100;

export type PlotlineMember = EntityRef<'story' | 'event'>;

export interface Plotline {
  id: string;
  slug: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  color?: string;
  status?: PlotlineStatus;
  members?: PlotlineMember[];
  memberKeys?: string[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredPlotline = Omit<Plotline, 'id'>;

export interface PlotlineDraft {
  slug: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  color?: string;
  status?: PlotlineStatus;
}

export function memberKeyOf(ref: PlotlineMember): string {
  return `${ref.kind}:${ref.id}`;
}

export function deriveMemberKeys(members: readonly PlotlineMember[]): string[] {
  return members.map(memberKeyOf);
}
