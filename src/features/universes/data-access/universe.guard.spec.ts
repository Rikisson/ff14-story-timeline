import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthStore } from '@features/auth';
import { editorGuard, universeGuard } from './universe.guard';
import { UniverseStore } from './universe.store';

interface MockUniverses {
  loading: ReturnType<typeof signal<boolean>>;
  activeUniverseId: ReturnType<typeof signal<string | null>>;
  isMemberOfActive: ReturnType<typeof signal<boolean>>;
}

interface MockAuth {
  loading: ReturnType<typeof signal<boolean>>;
  user: ReturnType<typeof signal<unknown>>;
}

function setup(state: {
  authLoading?: boolean;
  user?: unknown;
  universesLoading?: boolean;
  activeUniverseId?: string | null;
  isMember?: boolean;
}) {
  const auth: MockAuth = {
    loading: signal(state.authLoading ?? false),
    user: signal(state.user ?? null),
  };
  const universes: MockUniverses = {
    loading: signal(state.universesLoading ?? false),
    activeUniverseId: signal(state.activeUniverseId ?? null),
    isMemberOfActive: signal(state.isMember ?? false),
  };
  const urlTree = {} as UrlTree;
  const router = { createUrlTree: vi.fn(() => urlTree) } satisfies Partial<Router>;
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: UniverseStore, useValue: universes },
      { provide: Router, useValue: router },
    ],
  });
  return { auth, universes, router, urlTree };
}

function runUniverseGuard(): Promise<boolean | UrlTree> {
  return TestBed.runInInjectionContext(() =>
    universeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

function runEditorGuard(): Promise<boolean | UrlTree> {
  return TestBed.runInInjectionContext(() =>
    editorGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

describe('universeGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('returns true when a universe is active', async () => {
    setup({ activeUniverseId: 'u-1' });
    await expect(runUniverseGuard()).resolves.toBe(true);
  });

  it('redirects to landing when no universe is active', async () => {
    const { router, urlTree } = setup({ activeUniverseId: null });
    await expect(runUniverseGuard()).resolves.toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('waits for the universe store to finish loading before deciding', async () => {
    const { universes } = setup({ universesLoading: true, activeUniverseId: null });
    const pending = runUniverseGuard();
    await Promise.resolve();
    universes.activeUniverseId.set('u-1');
    universes.loading.set(false);
    await expect(pending).resolves.toBe(true);
  });
});

describe('editorGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('returns true for a signed-in member of the active universe', async () => {
    setup({ user: { uid: 'u1' }, activeUniverseId: 'u-1', isMember: true });
    await expect(runEditorGuard()).resolves.toBe(true);
  });

  it('redirects when the user is not signed in', async () => {
    const { router, urlTree } = setup({ user: null, activeUniverseId: 'u-1', isMember: true });
    await expect(runEditorGuard()).resolves.toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('redirects when no universe is active', async () => {
    const { router, urlTree } = setup({ user: { uid: 'u1' }, activeUniverseId: null });
    await expect(runEditorGuard()).resolves.toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('redirects when the user is not a member of the active universe', async () => {
    const { router, urlTree } = setup({
      user: { uid: 'u1' },
      activeUniverseId: 'u-1',
      isMember: false,
    });
    await expect(runEditorGuard()).resolves.toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
