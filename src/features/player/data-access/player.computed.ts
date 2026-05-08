import { computed } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';
import { Scene } from '@features/stories';
import { PlayerState } from './player.state';

export function withPlayerComputed() {
  return signalStoreFeature(
    { state: type<PlayerState>() },
    withComputed((state) => ({
      currentScene: computed<Scene | null>(() => {
        const content = state.content();
        const id = state.currentSceneId();
        return content && id ? (content.scenes[id] ?? null) : null;
      }),
      canGoBack: computed(() => state.history().length > 1),
    })),
  );
}
