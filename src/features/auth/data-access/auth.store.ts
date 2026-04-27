import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { AuthUser } from './auth.types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, firebase = inject(FirebaseService)) => ({
    async login(): Promise<void> {
      patchState(store, { error: null });
      try {
        await signInWithPopup(firebase.auth, new GoogleAuthProvider());
      } catch (err) {
        console.error('login failed', err);
        patchState(store, { error: errorMessage(err) });
      }
    },
    async logout(): Promise<void> {
      patchState(store, { error: null });
      try {
        await signOut(firebase.auth);
      } catch (err) {
        console.error('logout failed', err);
        patchState(store, { error: errorMessage(err) });
      }
    },
  })),
  withHooks((store) => {
    const firebase = inject(FirebaseService);
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    return {
      onInit() {
        if (!isBrowser) {
          patchState(store, { loading: false });
          return;
        }
        onAuthStateChanged(firebase.auth, (user) => {
          patchState(store, { user: toAuthUser(user), loading: false, error: null });
        });
      },
    };
  }),
);
