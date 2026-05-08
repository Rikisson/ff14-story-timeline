import { Story, StoryContent } from '@features/stories';

export interface SavedProgress {
  sceneId: string;
  history: string[];
}

export type PlayerState = {
  story: Story | null;
  content: StoryContent | null;
  currentSceneId: string | null;
  history: string[];
  loading: boolean;
  error: string | null;
  pendingResume: SavedProgress | null;
};

export const initialPlayerState: PlayerState = {
  story: null,
  content: null,
  currentSceneId: null,
  history: [],
  loading: false,
  error: null,
  pendingResume: null,
};
