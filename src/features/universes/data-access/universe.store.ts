import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { AuthStore } from '@features/auth';
import { Universe } from './universe.types';
import { UniversesService } from './universes.service';

const STORAGE_KEY = 'ff14-story-timeline.activeUniverseId';

interface UniverseState {
  universes: Universe[];
  pendingForAuthor: Universe[];
  activeUniverseId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: UniverseState = {
  universes: [],
  pendingForAuthor: [],
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
        (u) => u.authorUid === uid || u.editorUids.includes(uid),
      );
    }),
    isMemberOfActive: computed<boolean>(() => {
      const uid = auth.user()?.uid;
      const id = store.activeUniverseId();
      if (!uid || !id) return false;
      const u = store.universes().find((x) => x.id === id);
      if (!u) return false;
      return u.authorUid === uid || u.editorUids.includes(uid);
    }),
    isOwnerOfActive: computed<boolean>(() => {
      const uid = auth.user()?.uid;
      const id = store.activeUniverseId();
      if (!uid || !id) return false;
      const u = store.universes().find((x) => x.id === id);
      return !!u && u.authorUid === uid;
    }),
    canCreateUniverse: computed<boolean>(() => !!auth.user()?.uid),
  })),
  withMethods(
    (store, service = inject(UniversesService), auth = inject(AuthStore)) => ({
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
      async refreshPending(): Promise<void> {
        const uid = auth.user()?.uid;
        if (!uid) {
          patchState(store, { pendingForAuthor: [] });
          return;
        }
        try {
          const pending = await service.listPendingForAuthor(uid);
          patchState(store, { pendingForAuthor: pending });
        } catch (err) {
          console.error('failed to load pending-cleanup universes', err);
          patchState(store, { pendingForAuthor: [] });
        }
      },
    }),
  ),
  withHooks((store) => {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    const auth = inject(AuthStore);
    return {
      onInit() {
        if (!isBrowser) return;
        const stored = readStoredActiveId(isBrowser);
        if (stored) patchState(store, { activeUniverseId: stored });

        let lastUid: string | null | undefined = undefined;
        effect(() => {
          if (auth.loading()) return;
          const uid = auth.user()?.uid ?? null;
          if (uid === lastUid) return;
          lastUid = uid;
          void store.refresh();
          void store.refreshPending();
        });

        effect(() => {
          writeStoredActiveId(isBrowser, store.activeUniverseId());
        });
      },
    };
  }),
);
