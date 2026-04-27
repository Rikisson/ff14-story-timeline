export interface TimelineEvent {
  id: string;
  name: string;
  description: string;
  mainCharacters: string[];
  places: string[];
  inGameDate: string;
  relatedDates: string[];
  authorUid: string;
  createdAt: number;
}

export type StoredTimelineEvent = Omit<TimelineEvent, 'id'>;

export interface TimelineEventDraft {
  name: string;
  description: string;
  mainCharacters: string[];
  places: string[];
  inGameDate: string;
  relatedDates: string[];
}
