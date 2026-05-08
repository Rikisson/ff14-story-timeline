export type PlotlineStatus = 'planned' | 'active' | 'resolved';

export const PLOTLINE_STATUS_LABEL: Record<PlotlineStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  resolved: 'Resolved',
};

export interface Plotline {
  id: string;
  slug: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  color?: string;
  status?: PlotlineStatus;
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
