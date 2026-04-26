import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { catchError, from, map, of, switchMap } from 'rxjs';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { AuthActions } from './auth.actions';
import { AuthUser } from './auth.types';

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly firebase = inject(FirebaseService);
  private readonly store = inject(Store);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (!this.isBrowser) {
      this.store.dispatch(AuthActions.userChanged({ user: null }));
      return;
    }
    onAuthStateChanged(this.firebase.auth, (user) => {
      this.store.dispatch(AuthActions.userChanged({ user: toAuthUser(user) }));
    });
  }

  readonly login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      switchMap(() =>
        from(signInWithPopup(this.firebase.auth, new GoogleAuthProvider())).pipe(
          map(() => AuthActions.loginSuccess()),
          catchError((err: unknown) => {
            const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            console.error('login failed', err);
            return of(AuthActions.loginFailure({ error: message }));
          }),
        ),
      ),
    ),
  );

  readonly logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      switchMap(() =>
        from(signOut(this.firebase.auth)).pipe(
          map(() => AuthActions.logoutSuccess()),
          catchError((err: unknown) => {
            const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            console.error('logout failed', err);
            return of(AuthActions.logoutFailure({ error: message }));
          }),
        ),
      ),
    ),
  );
}
