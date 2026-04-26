import { computed } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';
import { Scene } from '@features/stories';
import { PlayerState } from './player.state';

export function withPlayerComputed() {
  return signalStoreFeature(
    { state: type<PlayerState>() },
    withComputed((state) => ({
      currentScene: computed<Scene | null>(() => {
        const story = state.story();
        const id = state.currentSceneId();
        return story && id ? (story.scenes[id] ?? null) : null;
      }),
    })),
  );
}
