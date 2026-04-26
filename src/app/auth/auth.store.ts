import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { FirebaseService } from '../firebase/firebase.service';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, firebase = inject(FirebaseService)) => ({
    async signIn() {
      patchState(store, { error: null });
      try {
        await signInWithPopup(firebase.auth, new GoogleAuthProvider());
      } catch (err) {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error('signIn failed', err);
        patchState(store, { error: message });
      }
    },
    async signOut() {
      patchState(store, { error: null });
      try {
        await signOut(firebase.auth);
      } catch (err) {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error('signOut failed', err);
        patchState(store, { error: message });
      }
    },
    _setUser(user: User | null) {
      patchState(store, { user, loading: false });
    },
  })),
  withHooks({
    onInit(store, platformId = inject(PLATFORM_ID), firebase = inject(FirebaseService)) {
      if (!isPlatformBrowser(platformId)) {
        patchState(store, { loading: false });
        return;
      }
      onAuthStateChanged(firebase.auth, (user) => store._setUser(user));
    },
  }),
);
