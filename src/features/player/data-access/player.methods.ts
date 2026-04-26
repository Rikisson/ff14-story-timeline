import { inject } from '@angular/core';
import { patchState, signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { StoriesService, Story } from '@features/stories';
import { PlayerState, SavedProgress } from './player.state';

const STORAGE_PREFIX = 'ff14-story-timeline:player:';

function storageKey(storyId: string): string {
  return STORAGE_PREFIX + storyId;
}

function loadSaved(storyId: string): SavedProgress | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(storyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (
      typeof parsed?.sceneId !== 'string' ||
      !Array.isArray(parsed?.history) ||
      !parsed.history.every((h) => typeof h === 'string')
    ) {
      return null;
    }
    return { sceneId: parsed.sceneId, history: parsed.history };
  } catch {
    return null;
  }
}

function saveProgress(storyId: string, progress: SavedProgress): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(storyId), JSON.stringify(progress));
  } catch {
    // Quota or disabled storage — ignore.
  }
}

function clearProgress(storyId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(storyId));
  } catch {
    // ignore
  }
}

function isUsableResume(story: Story, saved: SavedProgress): boolean {
  if (saved.sceneId === story.startSceneId) return false;
  if (!Object.prototype.hasOwnProperty.call(story.scenes, saved.sceneId)) return false;
  return saved.history.every((id) => Object.prototype.hasOwnProperty.call(story.scenes, id));
}

export function withPlayerMethods() {
  return signalStoreFeature(
    { state: type<PlayerState>() },
    withMethods((store, stories = inject(StoriesService)) => ({
      async loadStory(id: string) {
        patchState(store, { loading: true, error: null, pendingResume: null });
        try {
          const story = await stories.getStory(id);
          if (!story) {
            patchState(store, { loading: false, error: `Story not found: ${id}` });
            return;
          }
          const saved = loadSaved(id);
          const pending = saved && isUsableResume(story, saved) ? saved : null;
          if (saved && !pending) clearProgress(id);
          patchState(store, {
            story,
            currentSceneId: story.startSceneId,
            history: [story.startSceneId],
            loading: false,
            pendingResume: pending,
          });
        } catch (err) {
          const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          patchState(store, { loading: false, error: message });
        }
      },

      choose(sceneId: string) {
        patchState(store, (state) => {
          if (!state.story) return state;
          const history = [...state.history, sceneId];
          const isEnd = state.story.scenes[sceneId]?.next.length === 0;
          if (isEnd) clearProgress(state.story.id);
          else saveProgress(state.story.id, { sceneId, history });
          return { currentSceneId: sceneId, history };
        });
      },

      back() {
        patchState(store, (state) => {
          if (state.history.length <= 1 || !state.story) return state;
          const history = state.history.slice(0, -1);
          const sceneId = history[history.length - 1];
          if (sceneId === state.story.startSceneId) clearProgress(state.story.id);
          else saveProgress(state.story.id, { sceneId, history });
          return { currentSceneId: sceneId, history };
        });
      },

      restart() {
        patchState(store, (state) => {
          if (!state.story) return state;
          clearProgress(state.story.id);
          return {
            currentSceneId: state.story.startSceneId,
            history: [state.story.startSceneId],
            pendingResume: null,
          };
        });
      },

      resume() {
        patchState(store, (state) => {
          if (!state.pendingResume) return state;
          return {
            currentSceneId: state.pendingResume.sceneId,
            history: state.pendingResume.history,
            pendingResume: null,
          };
        });
      },

      dismissResume() {
        patchState(store, (state) => {
          if (!state.pendingResume || !state.story) return state;
          clearProgress(state.story.id);
          return { pendingResume: null };
        });
      },
    })),
  );
}
