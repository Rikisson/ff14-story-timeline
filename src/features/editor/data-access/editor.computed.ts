import { computed } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';
import { SLUG_PATTERN } from '@shared/models';
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
      metaValid: computed<boolean>(() => {
        const meta = state.meta();
        if (!meta) return false;
        return SLUG_PATTERN.test(meta.slug);
      }),
      orphanSceneIds: computed<string[]>(() => {
        const scenes = state.scenes();
        const start = state.startSceneId();
        if (!start || !scenes[start]) return [];
        const reachable = new Set<string>();
        const queue: string[] = [start];
        while (queue.length) {
          const id = queue.shift()!;
          if (reachable.has(id)) continue;
          reachable.add(id);
          const scene = scenes[id];
          if (!scene) continue;
          for (const next of scene.next) {
            if (!reachable.has(next.sceneId)) queue.push(next.sceneId);
          }
        }
        return Object.keys(scenes).filter((id) => !reachable.has(id));
      }),
    })),
  );
}
