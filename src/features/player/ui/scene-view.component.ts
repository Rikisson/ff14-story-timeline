import { ChangeDetectionStrategy, Component, effect, input, signal, viewChild } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { ContentLangDirective } from '@features/universes';
import { TextSpeed } from '@features/stories';
import { TypewriterTextComponent } from '@shared/ui';
import { InlineRefOption } from '@shared/utils';
import playerEn from '../i18n/en.json';
import playerUk from '../i18n/uk.json';

export interface StagedView {
  id: string;
  name: string;
  position: string;
  order?: number;
  spriteUrl?: string;
  isSpeaker: boolean;
}

const POSITION_SLOTS = ['left', 'center', 'right'] as const;
type PositionSlot = (typeof POSITION_SLOTS)[number];

type CrossfadeSlot = 'A' | 'B';

/**
 * Per `docs/narrative-engine-impl.md` *Scene rendering layers*:
 *   - Three independent DOM layers (background / characters / text scrim)
 *     are siblings and overlap absolutely inside the article frame.
 *   - Background swaps use two stacked `<img>` slots with CSS opacity
 *     crossfade; identical URLs skip the swap so consecutive same-bg
 *     scenes don't flicker.
 *   - `blurDataUrl` paints immediately as a placeholder underneath the
 *     slots — the full image fades in on top once it loads.
 *   - The audio host lives in `player.page.ts` above this component so
 *     ambient tracks survive scene re-renders.
 *   - Scene text reveals via `<app-typewriter-text>` at the authored
 *     speed; clicking anywhere on the article frame skips a mid-reveal
 *     to the fully revealed state (standard VN gesture).
 */
@Component({
  selector: 'app-scene-view',
  imports: [TypewriterTextComponent, TranslocoDirective, ContentLangDirective],
  providers: [
    provideTranslocoScope({
      scope: 'player',
      loader: {
        en: () => Promise.resolve(playerEn),
        uk: () => Promise.resolve(playerUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'player'">
      <article
        class="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface"
        (click)="onArticleClick($event)"
      >
        <!-- Background layer: blur placeholder underneath, two crossfading slots on top. -->
        <div class="absolute inset-0" aria-hidden="true">
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

        <!-- Character layer: positioned slots, full-saturation sprites untouched by background filters. -->
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

        <!-- Text scrim layer: gradient + speaker + text. -->
        <div
          appContentLang
          class="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-scrim/85 via-scrim/55 to-transparent px-5 pb-4 pt-16"
          style="font-size: var(--scene-font-size, 1rem);"
        >
          @if (speaker(); as s) {
            <p class="m-0 text-sm font-semibold text-scrim-foreground/90">{{ s }}</p>
          }
          <app-typewriter-text
            #typewriter
            class="leading-relaxed text-scrim-foreground"
            [text]="text()"
            [options]="inlineRefOptions()"
            [speed]="textSpeed()"
          />
        </div>
      </article>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneViewComponent {
  readonly text = input.required<string>();
  readonly speaker = input<string | undefined>();
  readonly background = input<string | undefined>();
  readonly backgroundBlurDataUrl = input<string | undefined>();
  readonly staged = input<StagedView[]>([]);
  readonly inlineRefOptions = input<InlineRefOption[]>([]);
  readonly textSpeed = input<TextSpeed>('fast');

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
   * Click-anywhere-to-skip the typewriter reveal. If the reveal had work
   * left to finish we stop the event so the same click doesn't also
   * advance the scene; otherwise the click passes through (which today
   * is a no-op — the article frame has no other click handlers).
   */
  protected onArticleClick(event: MouseEvent): void {
    const tw = this.typewriter();
    if (!tw) return;
    const completed = tw.complete();
    if (completed) event.stopPropagation();
  }
}
