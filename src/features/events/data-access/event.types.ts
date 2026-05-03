import { EntityRef, InGameDate } from '@shared/models';

export interface TimelineEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  mainCharacters: EntityRef<'character'>[];
  places: EntityRef<'place'>[];
  inGameDate: InGameDate;
  relatedDates: string[];
  type?: string;
  summary?: string;
  sortOrder?: number;
  consequences?: string;
  relatedEvents?: EntityRef<'event'>[];
  plotlineRefs?: EntityRef<'plotline'>[];
  itemRefs?: EntityRef<'item'>[];
  factionRefs?: EntityRef<'faction'>[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredTimelineEvent = Omit<TimelineEvent, 'id'>;

export interface TimelineEventDraft {
  slug: string;
  name: string;
  description: string;
  mainCharacters: EntityRef<'character'>[];
  places: EntityRef<'place'>[];
  inGameDate: InGameDate;
  relatedDates: string[];
  type?: string;
  summary?: string;
  sortOrder?: number;
  consequences?: string;
  relatedEvents?: EntityRef<'event'>[];
  plotlineRefs?: EntityRef<'plotline'>[];
  itemRefs?: EntityRef<'item'>[];
  factionRefs?: EntityRef<'faction'>[];
}
