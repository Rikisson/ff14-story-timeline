import { BackgroundEffect, EntityRef, InGameDate } from '@shared/models';

export interface StagedCharacter {
  entity: EntityRef<'character'>;
  position: string;
  order?: number;
  spriteId?: string;
  facing?: 'left' | 'right';
}

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export type BgmTransition = 'crossfade' | 'cut';
export type SceneLayout = 'dialog' | 'showcase';
// Visual transition played when the reader enters this scene. Undefined
// means an instant cut. Distinct from `BgmTransition`, which only governs
// the audio crossfade.
export type SceneTransition = 'crossfade' | 'fade-through-black';

export interface Scene {
  text: string;
  label?: string;
  speaker?: EntityRef<'character'> | string;
  backgroundAssetId?: string;
  backgroundEffect?: BackgroundEffect;
  characters: StagedCharacter[];
  place?: EntityRef<'place'>;
  sfxAssetId?: string;
  bgmAssetId?: string;
  bgmSilence?: boolean;
  bgmTransition?: BgmTransition;
  textSpeed?: TextSpeed;
  layout?: SceneLayout;
  // Reader transition on entering this scene; `transitionMs` is the total
  // duration. Both undefined = instant cut.
  transition?: SceneTransition;
  transitionMs?: number;
  position: { x: number; y: number };
  next: Array<{ label?: string; sceneId: string }>;
  isEntry?: boolean;
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  bgmAssetId?: string;
  inGameDate: InGameDate;
  relatedRefs?: EntityRef[];
  authorUid: string;
  draft: boolean;
  createdAt: number;
  publishedAt?: number;
  updatedAt?: number;
  version?: number;
}

export interface StoryContent {
  defaultEntrySceneId: string;
  scenes: Record<string, Scene>;
}

export type StoredStory = Omit<Story, 'id'>;
export type StoredStoryContent = StoryContent;
