import { BackgroundEffect, EntityRef, InGameDate } from '@shared/models';

export interface TimelineEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverAssetId?: string;
  bgmAssetId?: string;
  backgroundEffect?: BackgroundEffect;
  inGameDate: InGameDate;
  relatedRefs?: EntityRef[];
  plotlineRefs?: EntityRef<'plotline'>[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredTimelineEvent = Omit<TimelineEvent, 'id'>;

export interface TimelineEventDraft {
  slug: string;
  name: string;
  description: string;
  coverAssetId?: string;
  bgmAssetId?: string;
  backgroundEffect?: BackgroundEffect;
  inGameDate: InGameDate;
  relatedRefs?: EntityRef[];
  plotlineRefs?: EntityRef<'plotline'>[];
}
