import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { StoriesService } from '../stories/stories.service';
import { Scene, Story } from '../stories/story.types';

type PlayerState = {
  story: Story | null;
  currentSceneId: string | null;
  history: string[];
  loading: boolean;
  error: string | null;
};

const initialState: PlayerState = {
  story: null,
  currentSceneId: null,
  history: [],
  loading: false,
  error: null,
};

export const PlayerStore = signalStore(
  withState(initialState),
  withComputed((state) => ({
    currentScene: computed<Scene | null>(() => {
      const story = state.story();
      const id = state.currentSceneId();
      return story && id ? (story.scenes[id] ?? null) : null;
    }),
  })),
  withMethods((store, stories = inject(StoriesService)) => ({
    async loadStory(id: string) {
      patchState(store, { loading: true, error: null });
      try {
        const story = await stories.getStory(id);
        if (!story) {
          patchState(store, { loading: false, error: `Story not found: ${id}` });
          return;
        }
        patchState(store, {
          story,
          currentSceneId: story.startSceneId,
          history: [story.startSceneId],
          loading: false,
        });
      } catch (err) {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        patchState(store, { loading: false, error: message });
      }
    },
    choose(sceneId: string) {
      patchState(store, (state) => ({
        currentSceneId: sceneId,
        history: [...state.history, sceneId],
      }));
    },
    restart() {
      patchState(store, (state) => ({
        currentSceneId: state.story?.startSceneId ?? null,
        history: state.story ? [state.story.startSceneId] : [],
      }));
    },
  })),
);
