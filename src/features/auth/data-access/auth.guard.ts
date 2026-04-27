import { effect, inject, Injector, runInInjectionContext } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const injector = inject(Injector);

  if (auth.loading()) {
    await new Promise<void>((resolve) => {
      runInInjectionContext(injector, () => {
        const ref = effect(() => {
          if (!auth.loading()) {
            ref.destroy();
            resolve();
          }
        });
      });
    });
  }

  return auth.user() ? true : router.createUrlTree(['/']);
};
