export { StaleStoryError, StoriesService } from './data-access/stories.service';
export type {
  BgmTransition,
  Scene,
  StagedCharacter,
  StoredStory,
  StoredStoryContent,
  Story,
  StoryContent,
  TextSpeed,
} from './data-access/story.types';
export {
  buildStoryDirectoryInputs,
  buildStoryTimelineInputs,
} from './data-access/story-projection';
