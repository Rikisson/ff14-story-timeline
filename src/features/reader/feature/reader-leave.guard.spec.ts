import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ReaderLeavable, readerLeaveGuard } from './reader-leave.guard';

// The guard only ever touches `component`; the snapshot args are
// irrelevant to it, so they're stubbed.
function invoke(component: ReaderLeavable): Promise<boolean> | boolean {
  const snap = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;
  return readerLeaveGuard(component, snap, state, state) as Promise<boolean> | boolean;
}

describe('readerLeaveGuard', () => {
  it("delegates to the page's beginExit() and resolves with its result", async () => {
    const component: ReaderLeavable = {
      beginExit: vi.fn().mockResolvedValue(true),
    };

    const result = await invoke(component);

    expect(component.beginExit).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });
});
