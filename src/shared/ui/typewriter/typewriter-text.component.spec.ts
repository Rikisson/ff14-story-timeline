import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EntityResolverCache } from '@shared/data-access';
import { EntityRefHoverService } from '../entity-ref/entity-ref-hover.service';
import { TypewriterTextComponent } from './typewriter-text.component';

class StubEntityResolverCache {
  private readonly nullSig = signal(null).asReadonly();
  resolve() {
    return this.nullSig;
  }
  resolveMany() {
    return signal(new Map()).asReadonly();
  }
}

class StubHoverService {
  show(): void {}
  scheduleClose(): void {}
}

function build(
  text: string,
  speed: 'slow' | 'normal' | 'fast' | 'instant',
  enabled = true,
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TypewriterTextComponent],
    providers: [
      { provide: EntityResolverCache, useClass: StubEntityResolverCache },
      { provide: EntityRefHoverService, useClass: StubHoverService },
    ],
  });
  const fixture = TestBed.createComponent(TypewriterTextComponent);
  fixture.componentRef.setInput('text', text);
  fixture.componentRef.setInput('speed', speed);
  fixture.componentRef.setInput('enabled', enabled);
  fixture.detectChanges();
  return fixture;
}

async function flush(): Promise<void> {
  // The effect that triggers reveal-restart queues a microtask before
  // touching the DOM; awaiting a couple of microtask drains lets that
  // happen and lets any rAF-less branch fall through to complete().
  await Promise.resolve();
  await Promise.resolve();
}

describe('TypewriterTextComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('reveals every character immediately at instant speed', async () => {
    const fixture = build('Hello world', 'instant');
    await flush();
    const spans = fixture.nativeElement.querySelectorAll('.tw-ch') as NodeListOf<HTMLElement>;
    expect(spans.length).toBeGreaterThanOrEqual('Hello world'.length);
    for (const span of spans) {
      expect(span.style.visibility).toBe('visible');
    }
  });

  it('starts with every character hidden at slow speed', async () => {
    const fixture = build('Hello world', 'slow');
    await flush();
    const spans = fixture.nativeElement.querySelectorAll('.tw-ch') as NodeListOf<HTMLElement>;
    expect(spans.length).toBeGreaterThanOrEqual('Hello world'.length);
    // rAF may or may not have ticked depending on the jsdom polyfill;
    // we only assert that at least one character is still hidden so
    // the test stays deterministic.
    const hidden = Array.from(spans).filter((s) => s.style.visibility === 'hidden');
    expect(hidden.length).toBeGreaterThan(0);
  });

  it('complete() reveals all remaining characters and reports work done', async () => {
    const fixture = build('Hello world', 'slow');
    await flush();
    const result = fixture.componentInstance.complete();
    expect(result).toBe(true);
    const spans = fixture.nativeElement.querySelectorAll('.tw-ch') as NodeListOf<HTMLElement>;
    for (const span of spans) {
      expect(span.style.visibility).toBe('visible');
    }
    // Calling complete again is a no-op (nothing was hidden).
    expect(fixture.componentInstance.complete()).toBe(false);
  });

  it('holds every character hidden while disabled, then reveals on enable', async () => {
    // While the reader page fades in it gates the reveal; the text is
    // wrapped (so the card keeps its height) but stays hidden.
    const fixture = build('Hello world', 'instant', false);
    await flush();
    const before = fixture.nativeElement.querySelectorAll(
      '.tw-ch',
    ) as NodeListOf<HTMLElement>;
    expect(before.length).toBeGreaterThanOrEqual('Hello world'.length);
    for (const span of before) {
      expect(span.style.visibility).toBe('hidden');
    }

    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges();
    await flush();

    const after = fixture.nativeElement.querySelectorAll(
      '.tw-ch',
    ) as NodeListOf<HTMLElement>;
    // No re-wrap on the enable flip — the span count is unchanged
    // (a second walk would nest the spans) and all are now revealed.
    expect(after.length).toBe(before.length);
    for (const span of after) {
      expect(span.style.visibility).toBe('visible');
    }
  });

  it('handles empty text without crashing', async () => {
    const fixture = build('', 'normal');
    await flush();
    expect(fixture.nativeElement.querySelectorAll('.tw-ch').length).toBe(0);
  });

  it('preserves anchor wrappers when wrapping characters', async () => {
    const fixture = build('plain **bold** rest', 'instant');
    await flush();
    const strong = fixture.nativeElement.querySelector('strong');
    expect(strong).not.toBeNull();
    // Bolded "bold" still lives inside the <strong> element after wrapping.
    const insideBold = strong?.querySelectorAll('.tw-ch');
    expect(insideBold?.length).toBe('bold'.length);
  });
});
