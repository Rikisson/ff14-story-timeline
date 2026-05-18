import { Story, StoryContent } from '@features/stories';

export interface SavedProgress {
  sceneId: string;
  history: string[];
}

export type ReaderState = {
  story: Story | null;
  content: StoryContent | null;
  currentSceneId: string | null;
  history: string[];
  loading: boolean;
  error: string | null;
  // True when the reader auto-resumed from localStorage on load. Drives
  // the "Start over" aside in the chrome and clears the first time the
  // reader navigates (any choose/back) or restarts.
  resumedFromSave: boolean;
};

export const initialReaderState: ReaderState = {
  story: null,
  content: null,
  currentSceneId: null,
  history: [],
  loading: false,
  error: null,
  resumedFromSave: false,
};
