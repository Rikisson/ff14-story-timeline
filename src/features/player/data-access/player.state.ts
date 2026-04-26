import { Story } from '@features/stories';

export type PlayerState = {
  story: Story | null;
  currentSceneId: string | null;
  history: string[];
  loading: boolean;
  error: string | null;
};

export const initialPlayerState: PlayerState = {
  story: null,
  currentSceneId: null,
  history: [],
  loading: false,
  error: null,
};
