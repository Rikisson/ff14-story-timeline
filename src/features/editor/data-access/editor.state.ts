import { Scene, Story } from '@features/stories';

export type EditorState = {
  storyId: string | null;
  meta: Pick<
    Story,
    'title' | 'summary' | 'mainCharacters' | 'places' | 'inGameDate' | 'draft' | 'publishedAt'
  > | null;
  authorUid: string | null;
  startSceneId: string | null;
  scenes: Record<string, Scene>;
  selectedSceneId: string | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
};

export const initialEditorState: EditorState = {
  storyId: null,
  meta: null,
  authorUid: null,
  startSceneId: null,
  scenes: {},
  selectedSceneId: null,
  loading: false,
  saving: false,
  dirty: false,
  error: null,
};
