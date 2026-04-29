import { effect, inject, Injector, runInInjectionContext } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@features/auth';
import { UniverseStore } from './universe.store';

async function waitForUniverses(injector: Injector): Promise<void> {
  const universes = injector.get(UniverseStore);
  if (!universes.loading() && universes.universes().length > 0) return;
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
}

export const universeGuard: CanActivateFn = async () => {
  const universes = inject(UniverseStore);
  const router = inject(Router);
  const injector = inject(Injector);

  await waitForUniverses(injector);

  return universes.activeUniverseId() ? true : router.createUrlTree(['/universes']);
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

  if (!universes.activeUniverseId()) return router.createUrlTree(['/universes']);
  if (!universes.isMemberOfActive()) return router.createUrlTree(['/universes']);
  return true;
};
