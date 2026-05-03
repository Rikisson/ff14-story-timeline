import { EntityRef, InGameDate } from '@shared/models';

export interface StagedCharacter {
  entity: EntityRef<'character'>;
  position: string;
  order?: number;
  portraitId?: string;
}

export interface Scene {
  text: string;
  label?: string;
  speaker?: EntityRef<'character'> | string;
  background?: string;
  characters: StagedCharacter[];
  place?: EntityRef<'place'>;
  audio?: string;
  position: { x: number; y: number };
  next: Array<{ label?: string; sceneId: string }>;
  mood?: string;
  timeOfDay?: string;
  itemRefs?: EntityRef<'item'>[];
  factionRefs?: EntityRef<'faction'>[];
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  description?: string;
  coverImage?: string;
  mainCharacters: EntityRef<'character'>[];
  places: EntityRef<'place'>[];
  inGameDate: InGameDate;
  startSceneId: string;
  scenes: Record<string, Scene>;
  genreTags?: string[];
  toneTags?: string[];
  relatedEvents?: EntityRef<'event'>[];
  plotlineRefs?: EntityRef<'plotline'>[];
  itemRefs?: EntityRef<'item'>[];
  factionRefs?: EntityRef<'faction'>[];
  authorUid: string;
  draft: boolean;
  publishedAt?: number;
  updatedAt?: number;
  version?: number;
}

export type StoredStory = Omit<Story, 'id'>;
