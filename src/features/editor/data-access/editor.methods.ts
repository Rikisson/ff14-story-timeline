import { inject } from '@angular/core';
import { patchState, signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { Scene, StoriesService, Story } from '@features/stories';
import { EditorState } from './editor.state';

export function withEditorMethods() {
  return signalStoreFeature(
    { state: type<EditorState>() },
    withMethods((store, stories = inject(StoriesService)) => ({
      async load(id: string) {
        patchState(store, { loading: true, error: null });
        try {
          const story = await stories.getStory(id);
          if (!story) {
            patchState(store, { loading: false, error: `Story not found: ${id}` });
            return;
          }
          patchState(store, {
            storyId: story.id,
            meta: {
              title: story.title,
              summary: story.summary,
              mainCharacters: story.mainCharacters,
              places: story.places,
              inGameDate: story.inGameDate,
              draft: story.draft,
              publishedAt: story.publishedAt,
            },
            authorUid: story.authorUid,
            startSceneId: story.startSceneId,
            scenes: story.scenes,
            selectedSceneId: null,
            dirty: false,
            loading: false,
          });
        } catch (err) {
          const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          patchState(store, { loading: false, error: message });
        }
      },

      async save() {
        const id = store.storyId();
        const meta = store.meta();
        const authorUid = store.authorUid();
        const startSceneId = store.startSceneId();
        if (!id || !meta || !authorUid || !startSceneId) return;

        patchState(store, { saving: true, error: null });
        try {
          const story: Story = {
            id,
            ...meta,
            authorUid,
            startSceneId,
            scenes: store.scenes(),
          };
          await stories.saveStory(story);
          patchState(store, { saving: false, dirty: false });
        } catch (err) {
          const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          patchState(store, { saving: false, error: message });
        }
      },

      selectScene(id: string | null) {
        patchState(store, { selectedSceneId: id });
      },

      updateScene(id: string, patch: Partial<Scene>) {
        patchState(store, (state) => {
          const existing = state.scenes[id];
          if (!existing) return state;
          return {
            scenes: { ...state.scenes, [id]: { ...existing, ...patch } },
            dirty: true,
          };
        });
      },

      moveScene(id: string, position: { x: number; y: number }) {
        patchState(store, (state) => {
          const existing = state.scenes[id];
          if (!existing) return state;
          if (existing.position.x === position.x && existing.position.y === position.y) {
            return state;
          }
          return {
            scenes: { ...state.scenes, [id]: { ...existing, position } },
            dirty: true,
          };
        });
      },

      addConnection(fromSceneId: string, toSceneId: string) {
        patchState(store, (state) => {
          const from = state.scenes[fromSceneId];
          if (!from) return state;
          if (from.next.some((n) => n.sceneId === toSceneId)) return state;
          return {
            scenes: {
              ...state.scenes,
              [fromSceneId]: { ...from, next: [...from.next, { sceneId: toSceneId }] },
            },
            dirty: true,
          };
        });
      },

      removeConnection(fromSceneId: string, toSceneId: string) {
        patchState(store, (state) => {
          const from = state.scenes[fromSceneId];
          if (!from) return state;
          const filtered = from.next.filter((n) => n.sceneId !== toSceneId);
          if (filtered.length === from.next.length) return state;
          return {
            scenes: { ...state.scenes, [fromSceneId]: { ...from, next: filtered } },
            dirty: true,
          };
        });
      },
    })),
  );
}
