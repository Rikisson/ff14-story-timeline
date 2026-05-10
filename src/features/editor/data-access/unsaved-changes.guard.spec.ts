import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

function run(component: HasUnsavedChanges): boolean {
  return unsavedChangesGuard(
    component,
    {} as ActivatedRouteSnapshot,
    {} as RouterStateSnapshot,
    {} as RouterStateSnapshot,
  ) as boolean;
}

describe('unsavedChangesGuard', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lets navigation through when there are no unsaved changes', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(run({ hasUnsavedChanges: () => false })).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('prompts the user when there are unsaved changes and returns the user choice', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(run({ hasUnsavedChanges: () => true })).toBe(true);

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(run({ hasUnsavedChanges: () => true })).toBe(false);
  });
});
