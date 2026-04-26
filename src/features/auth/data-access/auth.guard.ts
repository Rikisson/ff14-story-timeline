import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, firstValueFrom, map } from 'rxjs';
import { authFeature } from './auth.feature';

export const authGuard: CanActivateFn = async () => {
  const store = inject(Store);
  const router = inject(Router);

  const user = await firstValueFrom(
    store.select(authFeature.selectAuthState).pipe(
      filter((state) => !state.loading),
      map((state) => state.user),
    ),
  );

  return user ? true : router.createUrlTree(['/']);
};
