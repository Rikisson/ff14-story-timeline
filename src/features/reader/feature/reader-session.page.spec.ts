import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutStore } from '@shared/data-access';
import { ReaderSessionPage } from './reader-session.page';

describe('ReaderSessionPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('exits fullscreen only when the reader session is destroyed', () => {
    TestBed.configureTestingModule({
      imports: [ReaderSessionPage],
      providers: [provideRouter([])],
    });

    // `LayoutStore` is a root singleton — inject it first so the spy is
    // installed on the same instance the component will receive.
    const layout = TestBed.inject(LayoutStore);
    const exitSpy = vi.spyOn(layout, 'exitFullscreen').mockResolvedValue(undefined);

    const fixture = TestBed.createComponent(ReaderSessionPage);
    fixture.detectChanges();

    // Mounted and alive: navigating between reader pages keeps this
    // component up, so fullscreen must be left untouched.
    expect(exitSpy).not.toHaveBeenCalled();

    // Destroying the component is what "leaving the reader" looks like.
    fixture.destroy();

    expect(exitSpy).toHaveBeenCalledTimes(1);
  });
});
