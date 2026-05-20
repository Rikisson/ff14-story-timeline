import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityResolverCache } from '@shared/data-access';
import { EntityRefHoverService } from '@shared/ui';
import { UniverseStore } from '@features/universes';
import { SceneLayout, TextSpeed } from '@features/stories';
import { SceneViewComponent } from './scene-view.component';

/** ContentLangDirective only reads `activeUniverse()` for a `lang` attr. */
class StubUniverseStore {
  activeUniverse = signal(null).asReadonly();
}

/** The typewriter (rendered inside the dialog card) needs these two. */
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

interface MountOptions {
  text: string;
  layout?: SceneLayout;
  cardHidden?: boolean;
  textSpeed?: TextSpeed;
}

async function mount(inputs: MountOptions): Promise<ComponentFixture<SceneViewComponent>> {
  TestBed.configureTestingModule({
    imports: [
      SceneViewComponent,
      // Preload the root langs *and* the component's `reader` scope so the
      // `*transloco` body renders synchronously — otherwise the scope's
      // async loader defers the whole article past the first detectChanges.
      TranslocoTestingModule.forRoot({
        langs: { en: {}, uk: {}, 'reader/en': {}, 'reader/uk': {} },
        translocoConfig: { availableLangs: ['en', 'uk'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
    providers: [
      { provide: UniverseStore, useClass: StubUniverseStore },
      { provide: EntityResolverCache, useClass: StubEntityResolverCache },
      { provide: EntityRefHoverService, useClass: StubHoverService },
    ],
  });
  const fixture = TestBed.createComponent(SceneViewComponent);
  fixture.componentRef.setInput('text', inputs.text);
  if (inputs.layout !== undefined) fixture.componentRef.setInput('layout', inputs.layout);
  if (inputs.cardHidden !== undefined)
    fixture.componentRef.setInput('cardHidden', inputs.cardHidden);
  if (inputs.textSpeed !== undefined)
    fixture.componentRef.setInput('textSpeed', inputs.textSpeed);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('SceneViewComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('hiding the dialog card', () => {
    const SENTINEL = 'SCENE_TEXT_SENTINEL_42';
    // The showcase caption is the centered `<p>`; the dialog card's
    // typewriter also emits `<p>` (markdown), so match on `text-center`.
    const CAPTION = 'article p.text-center';

    it('renders the floating card, visible, for a dialog scene', async () => {
      const fx = await mount({
        text: SENTINEL,
        layout: 'dialog',
        cardHidden: false,
        textSpeed: 'instant',
      });
      const host = fx.nativeElement as HTMLElement;
      const card = host.querySelector('.reader-card');
      expect(card).not.toBeNull();
      expect(card?.classList.contains('reader-card-hidden')).toBe(false);
      // No showcase caption in dialog layout.
      expect(host.querySelector(CAPTION)).toBeNull();
    });

    it('collapses the card via the hidden class, with no showcase caption', async () => {
      const fx = await mount({
        text: SENTINEL,
        layout: 'dialog',
        cardHidden: true,
        textSpeed: 'instant',
      });
      const host = fx.nativeElement as HTMLElement;
      // The card stays mounted (so the typewriter survives) but is
      // collapsed via `reader-card-hidden`...
      const card = host.querySelector('.reader-card');
      expect(card).not.toBeNull();
      expect(card?.classList.contains('reader-card-hidden')).toBe(true);
      // ...and the text must NOT reappear as a centered caption over the
      // background (the original bug: hiding the box rendered the scene
      // showcase-style).
      expect(host.querySelector(CAPTION)).toBeNull();
    });

    it('keeps the same card element across a hide/show toggle', async () => {
      // The card is CSS-hidden, not removed — so revealing it does not
      // recreate the typewriter and restart the text from character one.
      const fx = await mount({
        text: SENTINEL,
        layout: 'dialog',
        cardHidden: false,
        textSpeed: 'instant',
      });
      const host = fx.nativeElement as HTMLElement;
      const cardBefore = host.querySelector('.reader-card');
      expect(cardBefore).not.toBeNull();

      fx.componentRef.setInput('cardHidden', true);
      fx.detectChanges();
      fx.componentRef.setInput('cardHidden', false);
      fx.detectChanges();

      expect(host.querySelector('.reader-card')).toBe(cardBefore);
    });

    it('renders the centered caption for a showcase-layout scene', async () => {
      const fx = await mount({ text: SENTINEL, layout: 'showcase' });
      const host = fx.nativeElement as HTMLElement;
      const caption = host.querySelector(CAPTION);
      expect(caption).not.toBeNull();
      expect(caption?.textContent).toContain(SENTINEL);
      expect(host.querySelector('.reader-card')).toBeNull();
    });
  });
});
