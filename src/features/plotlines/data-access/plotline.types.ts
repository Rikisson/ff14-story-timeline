export type PlotlineStatus = 'planned' | 'active' | 'resolved';

export interface Plotline {
  id: string;
  slug: string;
  title: string;
  summary?: string;
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
  summary?: string;
  color?: string;
  status?: PlotlineStatus;
}
