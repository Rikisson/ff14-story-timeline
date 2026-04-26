import { inject } from '@angular/core';
import { patchState, signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { StoriesService } from '@features/stories';
import { PlayerState } from './player.state';

export function withPlayerMethods() {
  return signalStoreFeature(
    { state: type<PlayerState>() },
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
}
