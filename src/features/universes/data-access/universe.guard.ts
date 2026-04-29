import { effect, inject, Injector, runInInjectionContext } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@features/auth';
import { UniverseStore } from './universe.store';

async function waitForUniverses(injector: Injector): Promise<void> {
  const universes = injector.get(UniverseStore);
  if (!universes.loading()) return;
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

export const universeGuard: CanActivateFn = async () => {
  const universes = inject(UniverseStore);
  const router = inject(Router);
  const injector = inject(Injector);

  await waitForUniverses(injector);

  return universes.activeUniverseId() ? true : router.createUrlTree(['/']);
};

export const editorGuard: CanActivateFn = async () => {
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

  await waitForUniverses(injector);

  if (!universes.activeUniverseId()) return router.createUrlTree(['/']);
  if (!universes.isMemberOfActive()) return router.createUrlTree(['/']);
  return true;
};
