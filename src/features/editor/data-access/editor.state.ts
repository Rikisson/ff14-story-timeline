import { Scene, Story } from '@features/stories';

export type StoryMeta = Pick<
  Story,
  'slug' | 'title' | 'summary' | 'mainCharacters' | 'places' | 'inGameDate' | 'draft' | 'publishedAt'
>;

export type EditorState = {
  storyId: string | null;
  meta: StoryMeta | null;
  authorUid: string | null;
  startSceneId: string | null;
  scenes: Record<string, Scene>;
  selectedSceneId: string | null;
  version: number;
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
  version: 0,
  loading: false,
  saving: false,
  dirty: false,
  error: null,
};
