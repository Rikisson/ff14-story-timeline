import { inject } from '@angular/core';
import { patchState, signalMethod, signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { Scene, StoriesService, Story } from '@features/stories';
import { EditorState, StoryMeta } from './editor.state';

export function withEditorMethods() {
  return signalStoreFeature(
    { state: type<EditorState>() },
    withMethods((store, stories = inject(StoriesService)) => {
      let loadToken = 0;

      const load = async (id: string): Promise<void> => {
        const myToken = ++loadToken;
        patchState(store, { loading: true, error: null });
        try {
          const story = await stories.getStory(id);
          if (myToken !== loadToken) return;
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
            version: story.version ?? 0,
            dirty: false,
            loading: false,
          });
        } catch (err) {
          if (myToken !== loadToken) return;
          const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          patchState(store, { loading: false, error: message });
        }
      };

      return {
        load,

        bindLoad: signalMethod<string>((id) => {
          void load(id);
        }),

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
            const nextVersion = await stories.saveStory(story, store.version());
            patchState(store, { saving: false, dirty: false, version: nextVersion });
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

        addScene(position: { x: number; y: number } = { x: 0, y: 0 }): string {
          const id = crypto.randomUUID();
          const scene: Scene = {
            text: '',
            position,
            next: [],
          };
          patchState(store, (state) => ({
            scenes: { ...state.scenes, [id]: scene },
            startSceneId: state.startSceneId ?? id,
            selectedSceneId: id,
            dirty: true,
          }));
          return id;
        },

        removeScene(id: string) {
          patchState(store, (state) => {
            if (!state.scenes[id]) return state;
            const newScenes: Record<string, Scene> = {};
            for (const [otherId, scene] of Object.entries(state.scenes)) {
              if (otherId === id) continue;
              const filtered = scene.next.filter((n) => n.sceneId !== id);
              newScenes[otherId] =
                filtered.length === scene.next.length ? scene : { ...scene, next: filtered };
            }
            return {
              scenes: newScenes,
              startSceneId:
                state.startSceneId === id ? (Object.keys(newScenes)[0] ?? null) : state.startSceneId,
              selectedSceneId: state.selectedSceneId === id ? null : state.selectedSceneId,
              dirty: true,
            };
          });
        },

        setStartScene(id: string) {
          patchState(store, (state) =>
            state.scenes[id] && state.startSceneId !== id
              ? { startSceneId: id, dirty: true }
              : state,
          );
        },

        updateChoiceLabel(fromSceneId: string, toSceneId: string, label: string | undefined) {
          patchState(store, (state) => {
            const from = state.scenes[fromSceneId];
            if (!from) return state;
            const next = from.next.map((n) =>
              n.sceneId === toSceneId ? { ...n, label: label || undefined } : n,
            );
            return {
              scenes: { ...state.scenes, [fromSceneId]: { ...from, next } },
              dirty: true,
            };
          });
        },

        updateMeta(patch: Partial<StoryMeta>) {
          patchState(store, (state) => {
            if (!state.meta) return state;
            const merged: StoryMeta = { ...state.meta, ...patch };
            if (merged.draft === false && !merged.publishedAt) {
              merged.publishedAt = Date.now();
            }
            return { meta: merged, dirty: true };
          });
        },
      };
    }),
  );
}
