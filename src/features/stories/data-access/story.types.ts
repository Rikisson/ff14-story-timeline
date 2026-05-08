import { EntityRef, InGameDate } from '@shared/models';

export interface StagedCharacter {
  entity: EntityRef<'character'>;
  position: string;
  order?: number;
  spriteId?: string;
}

export interface Scene {
  text: string;
  label?: string;
  speaker?: EntityRef<'character'> | string;
  backgroundAssetId?: string;
  characters: StagedCharacter[];
  place?: EntityRef<'place'>;
  audioAssetId?: string;
  position: { x: number; y: number };
  next: Array<{ label?: string; sceneId: string }>;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  inGameDate: InGameDate;
  relatedRefs?: EntityRef[];
  plotlineRefs?: EntityRef<'plotline'>[];
  authorUid: string;
  draft: boolean;
  createdAt: number;
  publishedAt?: number;
  updatedAt?: number;
  version?: number;
}

export interface StoryContent {
  startSceneId: string;
  scenes: Record<string, Scene>;
}

export type StoredStory = Omit<Story, 'id'>;
export type StoredStoryContent = StoryContent;
