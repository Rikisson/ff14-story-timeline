import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { AuthEffects } from './data-access/auth.effects';
import { authFeature } from './data-access/auth.feature';

export { AuthActions } from './data-access/auth.actions';
export { authFeature } from './data-access/auth.feature';
export { authGuard } from './data-access/auth.guard';
export type { AuthUser } from './data-access/auth.types';
export { AuthButtonComponent } from './ui/auth-button.component';

export function provideAuthFeature() {
  return [provideState(authFeature), provideEffects([AuthEffects])];
}
