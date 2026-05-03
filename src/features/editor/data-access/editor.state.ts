import { Scene, Story } from '@features/stories';

export type StoryMeta = Pick<
  Story,
  | 'slug'
  | 'title'
  | 'summary'
  | 'coverImage'
  | 'mainCharacters'
  | 'places'
  | 'inGameDate'
  | 'draft'
  | 'publishedAt'
>;

// Fields the editor doesn't author yet but must preserve on save so they
// don't get wiped from existing stories.
export type StoryPassthrough = Pick<
  Story,
  | 'description'
  | 'genreTags'
  | 'toneTags'
  | 'relatedEvents'
  | 'plotlineRefs'
  | 'itemRefs'
  | 'factionRefs'
>;

export type EditorState = {
  storyId: string | null;
  meta: StoryMeta | null;
  passthrough: StoryPassthrough;
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
  passthrough: {},
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
