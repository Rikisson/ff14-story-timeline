import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth.store';

type MockAuth = { loading: ReturnType<typeof signal<boolean>>; user: ReturnType<typeof signal<unknown>> };

function setup(initial: { loading: boolean; user: unknown }) {
  const auth: MockAuth = {
    loading: signal(initial.loading),
    user: signal(initial.user),
  };
  const urlTree = {} as UrlTree;
  const router = { createUrlTree: vi.fn(() => urlTree) } satisfies Partial<Router>;
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: Router, useValue: router },
    ],
  });
  return { auth, router, urlTree };
}

function runGuard(): Promise<boolean | UrlTree> {
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

describe('authGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('returns true when a user is signed in', async () => {
    setup({ loading: false, user: { uid: 'u1' } });
    await expect(runGuard()).resolves.toBe(true);
  });

  it('redirects to landing when there is no user', async () => {
    const { router, urlTree } = setup({ loading: false, user: null });
    await expect(runGuard()).resolves.toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('waits for auth to finish loading before deciding', async () => {
    const { auth } = setup({ loading: true, user: null });
    const pending = runGuard();
    await Promise.resolve();
    auth.user.set({ uid: 'u1' });
    auth.loading.set(false);
    await expect(pending).resolves.toBe(true);
  });
});
