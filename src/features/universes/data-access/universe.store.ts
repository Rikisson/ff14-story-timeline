import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { AuthStore } from '@features/auth';
import { UNIVERSE_CREATOR_UIDS } from './universe-creators';
import { Universe } from './universe.types';
import { UniversesService } from './universes.service';

const STORAGE_KEY = 'ff14-story-timeline.activeUniverseId';

interface UniverseState {
  universes: Universe[];
  activeUniverseId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: UniverseState = {
  universes: [],
  activeUniverseId: null,
  loading: false,
  error: null,
};

function readStoredActiveId(isBrowser: boolean): string | null {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveId(isBrowser: boolean, id: string | null): void {
  if (!isBrowser) return;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

export const UniverseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store, auth = inject(AuthStore)) => ({
    activeUniverse: computed<Universe | null>(() => {
      const id = store.activeUniverseId();
      if (!id) return null;
      return store.universes().find((u) => u.id === id) ?? null;
    }),
    myUniverses: computed<Universe[]>(() => {
      const uid = auth.user()?.uid;
      if (!uid) return [];
      return store.universes().filter(
        (u) => u.ownerUid === uid || u.editorUids.includes(uid),
      );
    }),
    isMemberOfActive: computed<boolean>(() => {
      const uid = auth.user()?.uid;
      const id = store.activeUniverseId();
      if (!uid || !id) return false;
      const u = store.universes().find((x) => x.id === id);
      if (!u) return false;
      return u.ownerUid === uid || u.editorUids.includes(uid);
    }),
    canCreateUniverse: computed<boolean>(() => {
      const uid = auth.user()?.uid;
      return !!uid && UNIVERSE_CREATOR_UIDS.includes(uid);
    }),
  })),
  withMethods((store, service = inject(UniversesService)) => ({
    setActive(id: string | null): void {
      patchState(store, { activeUniverseId: id });
    },
    async refresh(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const universes = await service.listAll();
        const currentId = store.activeUniverseId();
        const stillValid = currentId && universes.some((u) => u.id === currentId);
        patchState(store, {
          universes,
          activeUniverseId: stillValid ? currentId : null,
          loading: false,
        });
      } catch (err) {
        console.error('failed to load universes', err);
        patchState(store, { loading: false, error: errorMessage(err) });
      }
    },
  })),
  withHooks((store) => {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    return {
      onInit() {
        if (!isBrowser) return;
        const stored = readStoredActiveId(isBrowser);
        if (stored) patchState(store, { activeUniverseId: stored });

        void store.refresh();

        effect(() => {
          writeStoredActiveId(isBrowser, store.activeUniverseId());
        });
      },
    };
  }),
);
