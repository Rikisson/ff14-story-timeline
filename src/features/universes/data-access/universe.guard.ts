import { effect, inject, Injector, runInInjectionContext } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@features/auth';
import { UniverseStore } from './universe.store';

export const universeGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const universes = inject(UniverseStore);
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

  if (!auth.user()) return router.createUrlTree(['/']);

  if (universes.loading()) {
    await new Promise<void>((resolve) => {
      runInInjectionContext(injector, () => {
        const ref = effect(() => {
          if (!universes.loading()) {
            ref.destroy();
            resolve();
          }
        });
      });
    });
  }

  return universes.activeUniverseId() ? true : router.createUrlTree(['/universes']);
};
