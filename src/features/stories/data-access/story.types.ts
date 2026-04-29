import { EntityRef } from '@shared/models';

export interface Scene {
  text: string;
  speaker?: string;
  background?: string;
  characters?: string[];
  audio?: string;
  position: { x: number; y: number };
  next: Array<{ label?: string; sceneId: string }>;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  mainCharacters: EntityRef<'character'>[];
  places: EntityRef<'place'>[];
  inGameDate: string;
  startSceneId: string;
  scenes: Record<string, Scene>;
  authorUid: string;
  draft: boolean;
  publishedAt?: number;
  updatedAt?: number;
  version?: number;
}

export type StoredStory = Omit<Story, 'id'>;
