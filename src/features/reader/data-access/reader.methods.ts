import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { FirebaseError } from 'firebase/app';
import { patchState, signalStoreFeature, type, withMethods } from '@ngrx/signals';
import { StoriesService, StoryContent } from '@features/stories';
import { ReaderState, SavedProgress } from './reader.state';

const STORAGE_PREFIX = 'ff14-story-timeline:reader:';
const LEGACY_STORAGE_PREFIX = 'ff14-story-timeline:player:';

function storageKey(storyId: string): string {
  return STORAGE_PREFIX + storyId;
}

function loadSaved(storyId: string): SavedProgress | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    let raw = localStorage.getItem(storageKey(storyId));
    if (raw === null) {
      // One-time migration from the legacy 'player:' prefix. After the
      // first read on the new key, the legacy entry is moved across and
      // cleared so subsequent reads cost a single hit.
      const legacy = localStorage.getItem(LEGACY_STORAGE_PREFIX + storyId);
      if (legacy !== null) {
        localStorage.setItem(storageKey(storyId), legacy);
        localStorage.removeItem(LEGACY_STORAGE_PREFIX + storyId);
        raw = legacy;
      }
    }
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

function isUsableResume(content: StoryContent, saved: SavedProgress): boolean {
  if (saved.sceneId === content.defaultEntrySceneId) return false;
  if (!Object.prototype.hasOwnProperty.call(content.scenes, saved.sceneId)) return false;
  return saved.history.every((id) => Object.prototype.hasOwnProperty.call(content.scenes, id));
}

export function withReaderMethods() {
  return signalStoreFeature(
    { state: type<ReaderState>() },
    withMethods((
      store,
      stories = inject(StoriesService),
      transloco = inject(TranslocoService),
    ) => {
      // Stale-response guard. Fast story switches (route changes, the
      // /reader/story/:id input toggling, universe selection flipping mid-load)
      // can land an older `getStoryWithContent` after a newer one. Only
      // the latest invocation's seq writes back into store state; older
      // resolutions short-circuit.
      let loadSeq = 0;
      return {
        async loadStory(id: string, entrySceneId?: string) {
          const seq = ++loadSeq;
          patchState(store, { loading: true, error: null, resumedFromSave: false });
          try {
            const result = await stories.getStoryWithContent(id);
            if (seq !== loadSeq) return;
            if (!result) {
              patchState(store, { loading: false, error: `Story not found: ${id}` });
              return;
            }
            const { story, content } = result;
            // An explicit entry (continuation target or cross-entity
            // back-nav) starts a read at that scene. When the entry is
            // exactly where the saved progress left off — the reader
            // coming *back* to the ending they continued from — the
            // saved history is restored so in-story Back keeps walking
            // scene by scene. Any other entry starts fresh.
            const entry =
              entrySceneId &&
              Object.prototype.hasOwnProperty.call(content.scenes, entrySceneId)
                ? entrySceneId
                : null;
            if (entry) {
              const saved = loadSaved(id);
              const resumable =
                saved &&
                saved.sceneId === entry &&
                saved.history.every((sceneId) =>
                  Object.prototype.hasOwnProperty.call(content.scenes, sceneId),
                )
                  ? saved
                  : null;
              patchState(store, {
                story,
                content,
                currentSceneId: entry,
                history: resumable?.history ?? [entry],
                loading: false,
                resumedFromSave: false,
              });
              return;
            }
            const saved = loadSaved(id);
            const usable = saved && isUsableResume(content, saved) ? saved : null;
            if (saved && !usable) clearProgress(id);
            patchState(store, {
              story,
              content,
              currentSceneId: usable?.sceneId ?? content.defaultEntrySceneId,
              history: usable?.history ?? [content.defaultEntrySceneId],
              loading: false,
              resumedFromSave: usable !== null,
            });
          } catch (err) {
            if (seq !== loadSeq) return;
            // Draft stories on /play for guests come back as
            // `permission-denied` from the Firestore rule. Translate
            // that into the same "unavailable" message we'd show for a
            // deleted story, rather than leaking the raw Firebase code.
            const isPermissionDenied =
              err instanceof FirebaseError && err.code === 'permission-denied';
            const message = isPermissionDenied
              ? transloco.translate('reader.message.storyUnavailable')
              : err instanceof Error
                ? `${err.name}: ${err.message}`
                : String(err);
            patchState(store, { loading: false, error: message });
          }
        },

        choose(sceneId: string) {
          patchState(store, (state) => {
            if (!state.story || !state.content) return state;
            const history = [...state.history, sceneId];
            // Progress is retained even on end-scenes so a reader can
            // chain forward through a continuation, hit the browser back
            // button, and land back on the ending they came from rather
            // than the start. Only `restart()` clears.
            saveProgress(state.story.id, { sceneId, history });
            return { currentSceneId: sceneId, history, resumedFromSave: false };
          });
        },

        back() {
          patchState(store, (state) => {
            if (state.history.length <= 1 || !state.story || !state.content) return state;
            const history = state.history.slice(0, -1);
            const sceneId = history[history.length - 1];
            if (sceneId === state.content.defaultEntrySceneId) clearProgress(state.story.id);
            else saveProgress(state.story.id, { sceneId, history });
            return { currentSceneId: sceneId, history, resumedFromSave: false };
          });
        },

        restart() {
          patchState(store, (state) => {
            if (!state.story || !state.content) return state;
            clearProgress(state.story.id);
            return {
              currentSceneId: state.content.defaultEntrySceneId,
              history: [state.content.defaultEntrySceneId],
              resumedFromSave: false,
            };
          });
        },
      };
    }),
  );
}
