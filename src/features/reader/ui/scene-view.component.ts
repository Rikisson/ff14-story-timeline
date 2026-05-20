import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
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
import { TypewriterTextComponent } from '@shared/ui';
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

const POSITION_RANK: Record<string, number> = { left: 0, center: 1, right: 2 };

// Horizontal room one staged sprite needs, as a multiple of stage
// height. Raise to drop sprites sooner on a narrow stage.
const MIN_STAGE_WIDTH_PER_SPRITE = 0.5;

// Fixed three-slot stage: one sprite centers, two take the outer pair
// (empty middle), three fill all — spacing never depends on the count.
const SLOT_CENTERS = [100 / 6, 50, 500 / 6];
const SLOT_LAYOUT: Record<number, readonly number[]> = {
  1: [1],
  2: [0, 2],
  3: [0, 1, 2],
};

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
        <!-- Character layer: staged sprites stand on the article floor,
             each snapped to a fixed slot of a three-slot stage so the
             gap between them never depends on how many are shown. Sizing
             is height-only (h-[88%]); window width never scales a sprite.
             When the stage is too narrow for all of them the
             lowest-priority non-speakers drop out rather than shrink. The
             floating card overlaps their lower body the way a VN expects;
             the layer is non-interactive so taps fall through. -->
        @if (!spritesHidden()) {
          <div class="pointer-events-none absolute inset-0">
            @for (s of placedStaged(); track s.id) {
              @if (s.spriteUrl; as url) {
                <img
                  [src]="url"
                  [alt]="s.name"
                  class="absolute bottom-0 h-[88%] w-auto object-contain drop-shadow-lg transition"
                  [class.grayscale]="!s.isSpeaker"
                  [class.brightness-90]="!s.isSpeaker"
                  [style.left.%]="s.leftPercent"
                  [style.transform]="s.transform"
                />
              } @else {
                <div
                  class="absolute bottom-0 flex aspect-[9/16] h-[55%] -translate-x-1/2 items-center justify-center rounded-lg border border-dashed border-scrim-foreground/40 bg-scrim/30 px-2 text-center text-sm text-scrim-foreground/80 transition"
                  [class.grayscale]="!s.isSpeaker"
                  [class.brightness-90]="!s.isSpeaker"
                  [style.left.%]="s.leftPercent"
                >
                  {{ t('empty.noSprite') }}
                </div>
              }
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
              class="reader-card backdrop-blur-sm"
              [class.reader-card-page]="cardVariant() === 'page'"
              [class.reader-card-hidden]="cardHidden()"
              [attr.tabindex]="cardVariant() === 'page' ? 0 : null"
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
              />
              @if (choices().length > 0) {
                <app-choice-list class="block shrink-0" [choices]="choices()" (choose)="choose.emit($event)" />
              } @else if (continuation(); as cont) {
                <a class="reader-action shrink-0" [routerLink]="cont.link">
                  {{ t('action.continueReading', { title: cont.label }) }}
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
  // Card presentation: 'floating' is the story reader's bottom-anchored
  // dialog card; 'page' is the event reader's centered reading panel.
  readonly cardVariant = input<'floating' | 'page'>('floating');
  // Reader header toggles. `cardHidden` collapses the floating text card
  // (it returns only via the header toggle); `spritesHidden` drops the
  // whole character layer.
  readonly cardHidden = input<boolean>(false);
  readonly spritesHidden = input<boolean>(false);
  // Horizontal placement of the speaker name above the card, driven by
  // the speaker's staged slot.
  readonly speakerPosition = input<'left' | 'center' | 'right'>('center');

  readonly choose = output<string>();

  protected readonly speakerPositionClass = computed(
    () => `reader-card-speaker reader-card-speaker-${this.speakerPosition()}`,
  );

  protected readonly backgroundEffectClass = computed(() => {
    const eff = this.backgroundEffect();
    return eff ? `reader-bg-effect-${eff}` : '';
  });

  private readonly typewriter = viewChild<TypewriterTextComponent>('typewriter');
  private readonly foreground = viewChild<ElementRef<HTMLElement>>('foreground');
  private readonly destroyRef = inject(DestroyRef);

  private readonly stageWidth = signal(0);
  private readonly stageHeight = signal(0);
  private resizeObserver?: ResizeObserver;

  private readonly visibleStaged = computed<StagedView[]>(() => {
    const ordered = [...this.staged()].sort(
      (a, b) =>
        (POSITION_RANK[a.position] ?? 1) - (POSITION_RANK[b.position] ?? 1) ||
        (a.order ?? 0) - (b.order ?? 0),
    );
    const width = this.stageWidth();
    const height = this.stageHeight();
    const fitsByWidth =
      width > 0 && height > 0
        ? Math.floor(width / (height * MIN_STAGE_WIDTH_PER_SPRITE))
        : SLOT_CENTERS.length;
    const capacity = Math.min(SLOT_CENTERS.length, Math.max(1, fitsByWidth));
    if (ordered.length <= capacity) return ordered;
    const byPriority = [...ordered].sort(
      (a, b) => Number(b.isSpeaker) - Number(a.isSpeaker),
    );
    const kept = new Set(byPriority.slice(0, capacity).map((s) => s.id));
    return ordered.filter((s) => kept.has(s.id));
  });

  protected readonly placedStaged = computed(() => {
    const visible = this.visibleStaged();
    const layout = SLOT_LAYOUT[visible.length] ?? [];
    return visible.map((s, i) => {
      const slot = layout[i] ?? 1;
      return {
        ...s,
        leftPercent: SLOT_CENTERS[slot] ?? 50,
        transform:
          s.facing === 'left'
            ? 'translateX(-50%) scaleX(-1)'
            : 'translateX(-50%)',
      };
    });
  });

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

    effect(() => {
      const host = this.foreground()?.nativeElement;
      if (!host || this.resizeObserver || typeof ResizeObserver === 'undefined') {
        return;
      }
      const measure = () => {
        this.stageWidth.set(host.clientWidth);
        this.stageHeight.set(host.clientHeight);
      };
      measure();
      this.resizeObserver = new ResizeObserver(measure);
      this.resizeObserver.observe(host);
      this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
    });
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
