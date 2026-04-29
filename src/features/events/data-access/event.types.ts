import { EntityRef } from '@shared/models';

export interface TimelineEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  mainCharacters: EntityRef<'character'>[];
  places: EntityRef<'place'>[];
  inGameDate: string;
  relatedDates: string[];
  authorUid: string;
  createdAt: number;
}

export type StoredTimelineEvent = Omit<TimelineEvent, 'id'>;

export interface TimelineEventDraft {
  slug: string;
  name: string;
  description: string;
  mainCharacters: EntityRef<'character'>[];
  places: EntityRef<'place'>[];
  inGameDate: string;
  relatedDates: string[];
}
