import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { getIdTokenResult } from 'firebase/auth';
import { AuthStore } from '@features/auth';
import { FirebaseService } from '../../../app/firebase/firebase.service';
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
  withComputed((store) => ({
    activeUniverse: computed<Universe | null>(() => {
      const id = store.activeUniverseId();
      if (!id) return null;
      return store.universes().find((u) => u.id === id) ?? null;
    }),
  })),
  withMethods((store, service = inject(UniversesService), firebase = inject(FirebaseService)) => ({
    setActive(id: string | null): void {
      patchState(store, { activeUniverseId: id });
    },
    async refreshForUser(uid: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const universes = await service.listForUser(uid);
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
    clear(): void {
      patchState(store, { universes: [], activeUniverseId: null, error: null });
    },
    async canCreateUniverse(): Promise<boolean> {
      const user = firebase.auth.currentUser;
      if (!user) return false;
      try {
        const token = await getIdTokenResult(user);
        return token.claims['universeCreator'] === true;
      } catch (err) {
        console.error('failed to read claims', err);
        return false;
      }
    },
  })),
  withHooks((store) => {
    const auth = inject(AuthStore);
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    return {
      onInit() {
        if (!isBrowser) return;
        const stored = readStoredActiveId(isBrowser);
        if (stored) patchState(store, { activeUniverseId: stored });

        effect(() => {
          const user = auth.user();
          if (!user) {
            store.clear();
            return;
          }
          void store.refreshForUser(user.uid);
        });

        effect(() => {
          writeStoredActiveId(isBrowser, store.activeUniverseId());
        });
      },
    };
  }),
);
