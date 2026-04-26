import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (auth.loading()) {
    await firstValueFrom(toObservable(auth.loading).pipe(filter((loading) => !loading)));
  }

  return auth.user() ? true : router.createUrlTree(['/']);
};
