import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AuthUser } from './auth.types';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    Login: emptyProps(),
    'Login Success': emptyProps(),
    'Login Failure': props<{ error: string }>(),
    Logout: emptyProps(),
    'Logout Success': emptyProps(),
    'Logout Failure': props<{ error: string }>(),
    'User Changed': props<{ user: AuthUser | null }>(),
  },
});
