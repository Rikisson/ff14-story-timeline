import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthActions } from './auth.actions';
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

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialState,
    on(AuthActions.login, (state) => ({ ...state, error: null })),
    on(AuthActions.loginFailure, (state, { error }) => ({ ...state, error })),
    on(AuthActions.logout, (state) => ({ ...state, error: null })),
    on(AuthActions.logoutFailure, (state, { error }) => ({ ...state, error })),
    on(AuthActions.userChanged, (state, { user }) => ({
      ...state,
      user,
      loading: false,
      error: null,
    })),
  ),
});
