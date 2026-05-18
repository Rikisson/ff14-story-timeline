import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { ContentLangDirective } from '@features/universes';
import { SceneLayout, TextSpeed } from '@features/stories';
import { BackgroundEffect } from '@shared/models';
import { TypewriterTextComponent } from '@shared/ui';
import { InlineRefOption } from '@shared/utils';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';
import { Choice, ChoiceListComponent } from './choice-list.component';

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
  imports: [TypewriterTextComponent, TranslocoDirective, ContentLangDirective, ChoiceListComponent],
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
      <article
        class="relative h-full w-full overflow-hidden rounded-lg border border-border bg-surface"
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

        <!-- Character layer: positioned slots over the background. The
             floating card sits above this layer in the dialog layout, so
             sprites visually root behind the card the way a VN expects. -->
        <div class="absolute inset-x-0 bottom-24 grid grid-cols-3 items-end gap-2 px-4">
          @for (slot of slots; track slot) {
            <div class="flex flex-wrap items-end justify-center gap-2">
              @for (s of stagedFor(slot); track s.id) {
                <figure
                  class="m-0 flex flex-col items-center gap-1 transition-opacity"
                  [class.opacity-40]="!s.isSpeaker"
                >
                  @if (s.spriteUrl; as url) {
                    <img
                      [src]="url"
                      [alt]="s.name"
                      class="size-32 object-contain drop-shadow-lg"
                      [class.-scale-x-100]="s.facing === 'left'"
                    />
                  } @else {
                    <div
                      class="flex size-32 items-center justify-center rounded-md border border-dashed border-scrim-foreground/40 bg-scrim/30 text-xs text-scrim-foreground/80"
                    >
                      {{ t('empty.noSprite') }}
                    </div>
                  }
                </figure>
              }
              @for (s of stagedOther(slot); track s.id) {
                <figure
                  class="m-0 flex flex-col items-center gap-1 transition-opacity"
                  [class.opacity-40]="!s.isSpeaker"
                  [title]="t('tooltip.position', { slot: s.position })"
                >
                  @if (s.spriteUrl; as url) {
                    <img
                      [src]="url"
                      [alt]="s.name"
                      class="size-32 object-contain drop-shadow-lg"
                      [class.-scale-x-100]="s.facing === 'left'"
                    />
                  } @else {
                    <div
                      class="flex size-32 items-center justify-center rounded-md border border-dashed border-scrim-foreground/40 bg-scrim/30 text-xs text-scrim-foreground/80"
                    >
                      {{ t('empty.noSprite') }}
                    </div>
                  }
                </figure>
              }
            </div>
          }
        </div>

        @if (layout() === 'dialog') {
          <div
            class="reader-card"
            appContentLang
            role="region"
            [attr.aria-label]="t('aria.narration')"
          >
            @if (speaker(); as s) {
              <p class="m-0 text-sm font-semibold text-accent">{{ s }}</p>
            }
            <app-typewriter-text
              #typewriter
              class="block leading-relaxed text-foreground"
              [text]="text()"
              [options]="inlineRefOptions()"
              [speed]="textSpeed()"
            />
            @if (choices().length > 0) {
              <app-choice-list [choices]="choices()" (choose)="choose.emit($event)" />
            }
          </div>
        } @else if (text(); as caption) {
          <!-- Showcase caption — pointer-events-none so taps fall through
               to the article and trigger advance via onArticleClick. -->
          <div
            class="pointer-events-none absolute inset-0 flex items-center justify-center px-8"
            appContentLang
          >
            <p class="m-0 text-center text-3xl font-semibold leading-tight text-scrim-foreground drop-shadow-[0_4px_18px_rgb(0_0_0/0.65)] sm:text-4xl md:text-5xl">
              {{ caption }}
            </p>
          </div>
        }
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
  readonly inlineRefOptions = input<InlineRefOption[]>([]);
  readonly textSpeed = input<TextSpeed>('fast');

  readonly choose = output<string>();

  protected readonly backgroundEffectClass = computed(() => {
    const eff = this.backgroundEffect();
    return eff ? `reader-bg-effect-${eff}` : '';
  });

  protected readonly slots = POSITION_SLOTS;
  private readonly typewriter = viewChild<TypewriterTextComponent>('typewriter');

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
   *    also trigger anything else.
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
    const tw = this.typewriter();
    if (!tw) return;
    const completed = tw.complete();
    if (completed) event.stopPropagation();
  }
}
