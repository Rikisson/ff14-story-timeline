import { computed } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';
import { Scene } from '@features/stories';
import { EditorState } from './editor.state';

export function withEditorComputed() {
  return signalStoreFeature(
    { state: type<EditorState>() },
    withComputed((state) => ({
      selectedScene: computed<Scene | null>(() => {
        const id = state.selectedSceneId();
        return id ? (state.scenes()[id] ?? null) : null;
      }),
    })),
  );
}
