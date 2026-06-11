import { Scene, Story } from '@features/stories';

export type StoryMeta = Pick<
  Story,
  | 'slug'
  | 'title'
  | 'description'
  | 'coverAssetId'
  | 'bgmAssetId'
  | 'relatedRefs'
  | 'plotlineRefs'
  | 'inGameDate'
  | 'draft'
  | 'publishedAt'
>;

export type EditorState = {
  storyId: string | null;
  meta: StoryMeta | null;
  authorUid: string | null;
  createdAt: number | null;
  defaultEntrySceneId: string | null;
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
  createdAt: null,
  defaultEntrySceneId: null,
  scenes: {},
  selectedSceneId: null,
  version: 0,
  loading: false,
  saving: false,
  dirty: false,
  error: null,
};
