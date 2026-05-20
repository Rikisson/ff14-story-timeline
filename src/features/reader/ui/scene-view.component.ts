import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { ContentLangDirective } from '@features/universes';
import { SceneLayout, TextSpeed } from '@features/stories';
import { BackgroundEffect } from '@shared/models';
import { SecondaryButtonComponent, TypewriterTextComponent } from '@shared/ui';
import { InlineRefOption } from '@shared/utils';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';
import { Choice, ChoiceListComponent } from './choice-list.component';

export interface SceneContinuation {
  label: string;
  link: readonly [string, string];
}

export interface StagedView {
  id: string;
  name: string;
  position: string;
  order?: number;
  spriteUrl?: string;
  isSpeaker: boolean;
  facing: 'left' | 'right';
}

const POSITION_SLOTS = ['left', 'center', 'right'] as const;
type PositionSlot = (typeof POSITION_SLOTS)[number];

type CrossfadeSlot = 'A' | 'B';

/**
 * Per `docs/narrative-engine-impl.md` *Scene rendering layers*:
 *   - Independent DOM layers (background / characters / floating card OR
 *     showcase caption) are siblings and overlap absolutely inside the
 *     16:9 article frame.
 *   - Background swaps use two stacked `<img>` slots with CSS opacity
 *     crossfade; identical URLs skip the swap so consecutive same-bg
 *     scenes don't flicker. A `blurDataUrl` paints immediately as a
 *     placeholder underneath the slots.
 *   - In `dialog` layout the floating `.reader-card` carries speaker,
 *     typewriter text, and choices. In `showcase` layout the card is
 *     absent and `text` (if any) renders as a centered caption — used by
 *     the auto-seeded title intro and any art-beat scenes.
 *   - The audio host lives in `reader-story.page.ts` above this component
 *     so ambient tracks survive scene re-renders.
 *   - Scene text reveals via `<app-typewriter-text>` at the authored
 *     speed; clicking anywhere on the article skips a mid-reveal. In
 *     `showcase` layout with a single `next`, the article click advances
 *     the scene instead.
 */
@Component({
  selector: 'app-scene-view',
  host: { class: 'block' },
  imports: [
    TypewriterTextComponent,
    TranslocoDirective,
    ContentLangDirective,
    ChoiceListComponent,
    SecondaryButtonComponent,
    RouterLink,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'reader',
      loader: {
        en: () => Promise.resolve(readerEn),
        uk: () => Promise.resolve(readerUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'reader'">
      <!-- Transparent: the reader page paints a static bg-canvas root
           underneath, which shows through for an imageless scene. -->
      <article
        class="relative h-full w-full overflow-hidden"
        (click)="onArticleClick($event)"
      >
        <!-- Background layer: blur placeholder underneath, two crossfading slots on top.
             Mood filter applied to the whole layer so it doesn't desaturate sprites. -->
        <div class="absolute inset-0" [class]="backgroundEffectClass()" aria-hidden="true">
          @if (backgroundBlurDataUrl(); as blur) {
            <img
              [src]="blur"
              alt=""
              class="absolute inset-0 size-full scale-105 object-cover blur-xl"
            />
          }
          @if (slotA(); as url) {
            <img
              [src]="url"
              alt=""
              class="absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out"
              [class.opacity-0]="frontSlot() !== 'A'"
            />
          }
          @if (slotB(); as url) {
            <img
              [src]="url"
              alt=""
              class="absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out"
              [class.opacity-0]="frontSlot() !== 'B'"
            />
          }
        </div>

        <!-- Foreground (characters + card / caption). Wrapped so a
             crossfade scene transition can fade it in over the
             independently-crossfading background. -->
        <div #foreground class="scene-foreground">
        <!-- Character layer: full-height slots over the background.
             Sprites root at the article floor and stand tall; the
             floating card (higher z-index) overlaps their lower body the
             way a VN expects, per docs/narrative-engine-impl.md *Scene
             rendering layers*. The layer is non-interactive so taps fall
             through to the article. -->
        @if (!spritesHidden()) {
        <div class="pointer-events-none absolute inset-0 grid grid-cols-3 gap-2 px-4">
          @for (slot of slots; track slot) {
            <div class="flex h-full items-end justify-center gap-2">
              @for (s of stagedFor(slot); track s.id) {
                <figure
                  class="m-0 flex h-full max-w-full items-end justify-center transition"
                  [class.grayscale]="!s.isSpeaker"
                  [class.brightness-90]="!s.isSpeaker"
                >
                  @if (s.spriteUrl; as url) {
                    <img
                      [src]="url"
                      [alt]="s.name"
                      class="max-h-[88%] w-auto max-w-full object-contain drop-shadow-lg"
                      [class.-scale-x-100]="s.facing === 'left'"
                    />
                  } @else {
                    <div
                      class="flex aspect-[9/16] h-[55%] items-center justify-center rounded-lg border border-dashed border-scrim-foreground/40 bg-scrim/30 px-2 text-center text-sm text-scrim-foreground/80"
                    >
                      {{ t('empty.noSprite') }}
                    </div>
                  }
                </figure>
              }
              @for (s of stagedOther(slot); track s.id) {
                <figure
                  class="m-0 flex h-full max-w-full items-end justify-center transition"
                  [class.grayscale]="!s.isSpeaker"
                  [class.brightness-90]="!s.isSpeaker"
                  [title]="t('tooltip.position', { slot: s.position })"
                >
                  @if (s.spriteUrl; as url) {
                    <img
                      [src]="url"
                      [alt]="s.name"
                      class="max-h-[88%] w-auto max-w-full object-contain drop-shadow-lg"
                      [class.-scale-x-100]="s.facing === 'left'"
                    />
                  } @else {
                    <div
                      class="flex aspect-[9/16] h-[55%] items-center justify-center rounded-lg border border-dashed border-scrim-foreground/40 bg-scrim/30 px-2 text-center text-sm text-scrim-foreground/80"
                    >
                      {{ t('empty.noSprite') }}
                    </div>
                  }
                </figure>
              }
            </div>
          }
        </div>
        }

        <!-- Layout picks the presentation shape; each case is
             self-contained so a new SceneLayout is an additive @case. -->
        @switch (layout()) {
          @case ('dialog') {
            <!-- The card stays mounted while collapsed (display:none via
                 the reader-card-hidden class) rather than removed, so the
                 typewriter keeps its reveal state — bringing the box back
                 must not restart the text from the first character. -->
            <div
              class="reader-card"
              [class.reader-card-overflow]="cardOverflow()"
              [class.reader-card-hidden]="cardHidden()"
              appContentLang
              role="region"
              aria-live="polite"
              [attr.aria-label]="t('aria.narration')"
            >
              @if (speaker(); as s) {
                <div [class]="speakerPositionClass()">
                  <span>{{ s }}</span>
                </div>
              }
              <app-typewriter-text
                #typewriter
                class="block leading-relaxed text-foreground"
                [text]="text()"
                [options]="inlineRefOptions()"
                [speed]="textSpeed()"
                [enabled]="revealEnabled()"
              />
              @if (choices().length > 0) {
                <app-choice-list class="mt-2 block" [choices]="choices()" (choose)="choose.emit($event)" />
              } @else if (continuation(); as cont) {
                <a
                  uiSecondary
                  [routerLink]="cont.link"
                  className="reader-action mt-2 w-full"
                >
                  <span class="min-w-0 flex-1 truncate text-left">{{ t('action.continueReading', { title: cont.label }) }}</span>
                  <span icon-trailing aria-hidden="true" class="leading-none -translate-y-px">&gt;</span>
                </a>
              }
            </div>
          }
          @case ('showcase') {
            <!-- Showcase caption — pointer-events-none so taps fall
                 through to the article and trigger advance via
                 onArticleClick. -->
            @if (text(); as caption) {
              <div
                class="pointer-events-none absolute inset-0 flex items-center justify-center px-8"
                appContentLang
              >
                <p class="m-0 text-center text-3xl font-semibold leading-tight text-scrim-foreground drop-shadow-[0_4px_18px_rgb(0_0_0/0.65)] sm:text-4xl md:text-5xl">
                  {{ caption }}
                </p>
              </div>
            }
          }
        }
        </div>
      </article>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneViewComponent {
  readonly text = input.required<string>();
  readonly layout = input<SceneLayout>('dialog');
  readonly speaker = input<string | undefined>();
  readonly background = input<string | undefined>();
  readonly backgroundBlurDataUrl = input<string | undefined>();
  readonly backgroundEffect = input<BackgroundEffect | undefined>(undefined);
  readonly staged = input<StagedView[]>([]);
  readonly choices = input<Choice[]>([]);
  // Single end-of-content continuation. Rendered as a full-width
  // anchor below the typewriter in dialog layout, only when there are
  // no in-story `choices`. Provided by the reader pages from the
  // resolved `nextRefs[0]` so the affordance lives inside the card —
  // a "Continue" the reader taps to advance into the next story or
  // event. Schema still keeps `nextRefs` as an array for future
  // flexibility; the cap-to-one is enforced in the editors.
  readonly continuation = input<SceneContinuation | null>(null);
  readonly inlineRefOptions = input<InlineRefOption[]>([]);
  readonly textSpeed = input<TextSpeed>('fast');
  // Caps the card height and adds a fade-out mask + vertical scroll.
  // Reader-event uses this for long descriptions; reader-story leaves
  // it false because scene text is capped by the editor at ~280 chars.
  readonly cardOverflow = input<boolean>(false);
  // Reader header toggles. `cardHidden` collapses the floating text card
  // (it returns only via the header toggle); `spritesHidden` drops the
  // whole character layer.
  readonly cardHidden = input<boolean>(false);
  readonly spritesHidden = input<boolean>(false);
  // Horizontal placement of the speaker name above the card, driven by
  // the speaker's staged slot.
  readonly speakerPosition = input<'left' | 'center' | 'right'>('center');
  // Gates the typewriter reveal. The reader page holds this false until
  // its entry fade-in finishes so the text animation isn't spent behind
  // the fade. Default true keeps standalone use unchanged.
  readonly revealEnabled = input<boolean>(true);

  readonly choose = output<string>();

  protected readonly speakerPositionClass = computed(
    () => `reader-card-speaker reader-card-speaker-${this.speakerPosition()}`,
  );

  protected readonly backgroundEffectClass = computed(() => {
    const eff = this.backgroundEffect();
    return eff ? `reader-bg-effect-${eff}` : '';
  });

  protected readonly slots = POSITION_SLOTS;
  private readonly typewriter = viewChild<TypewriterTextComponent>('typewriter');
  private readonly foreground = viewChild<ElementRef<HTMLElement>>('foreground');

  /**
   * Fade the foreground (characters + card) in over `durationMs`. Called
   * by the reader page when entering a `crossfade` scene — the background
   * runs its own two-slot crossfade underneath.
   */
  playEnterTransition(durationMs: number): void {
    this.foreground()?.nativeElement.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: durationMs, easing: 'ease-out' },
    );
  }

  // Two-slot crossfade state. `frontSlot` flips on each background
  // change; whichever slot becomes the front is opaque, the other
  // transitions to transparent (and stays mounted briefly so the
  // outgoing image is visible during the fade).
  protected readonly slotA = signal<string | undefined>(undefined);
  protected readonly slotB = signal<string | undefined>(undefined);
  protected readonly frontSlot = signal<CrossfadeSlot>('A');

  constructor() {
    effect(() => {
      const next = this.background();
      const front = this.frontSlot();
      const currentFront = front === 'A' ? this.slotA() : this.slotB();
      if (next === currentFront) return;
      if (front === 'A') {
        this.slotB.set(next);
        this.frontSlot.set('B');
      } else {
        this.slotA.set(next);
        this.frontSlot.set('A');
      }
    });
  }

  protected stagedFor(slot: PositionSlot): StagedView[] {
    return this.staged()
      .filter((s) => s.position === slot)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  protected stagedOther(slot: PositionSlot): StagedView[] {
    if (slot !== 'center') return [];
    const known = new Set<string>(POSITION_SLOTS);
    return this.staged()
      .filter((s) => !known.has(s.position))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * Click-anywhere dispatch.
   *  - Dialog: skip the typewriter if it's mid-reveal. Stops the event
   *    only when there was a reveal to complete so the same click can't
   *    also trigger anything else. While the card is hidden the click
   *    is ignored — the card returns only via the header text-box toggle.
   *  - Showcase with a single `next`: advance the scene. Multi-choice
   *    showcase scenes are out of scope per the design and silently
   *    ignore the click.
   */
  protected onArticleClick(event: MouseEvent): void {
    if (this.layout() === 'showcase') {
      const next = this.choices();
      if (next.length === 1) this.choose.emit(next[0].sceneId);
      return;
    }
    // Card hidden: the scene shows only the art. A scene click does
    // nothing — the card returns solely via the header text-box toggle.
    if (this.cardHidden()) return;
    const tw = this.typewriter();
    if (!tw) return;
    const completed = tw.complete();
    if (completed) event.stopPropagation();
  }
}
