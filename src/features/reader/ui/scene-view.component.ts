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

const MIN_STAGE_WIDTH_PER_SPRITE = 0.5;

const MAX_SLOTS = 3;
const SLOT_CENTERS_BY_COUNT: Record<number, readonly number[]> = {
  1: [50],
  2: [30, 70],
  3: [25, 50, 75],
};

type CrossfadeSlot = 'A' | 'B';

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
      <article
        class="relative h-full w-full overflow-hidden"
        (click)="onArticleClick($event)"
      >
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

        <div #foreground class="scene-foreground">
        @if (!spritesHidden()) {
          <div class="pointer-events-none absolute inset-0">
            @for (s of placedStaged(); track s.id) {
              @if (s.spriteUrl; as url) {
                <img
                  [src]="url"
                  [alt]="s.name"
                  class="reader-sprite absolute bottom-0 h-[88%] w-auto object-contain"
                  [class.reader-sprite-muted]="!s.isSpeaker"
                  [style.left.%]="s.leftPercent"
                  [style.transform]="s.transform"
                  animate.enter="reader-sprite-enter"
                  animate.leave="reader-sprite-leave"
                />
              } @else {
                <div
                  class="reader-sprite absolute bottom-0 flex aspect-[9/16] h-[55%] -translate-x-1/2 items-center justify-center rounded-lg border border-dashed border-scrim-foreground/40 bg-scrim/30 px-2 text-center text-sm text-scrim-foreground/80"
                  [class.reader-sprite-muted]="!s.isSpeaker"
                  [style.left.%]="s.leftPercent"
                  animate.enter="reader-sprite-enter"
                  animate.leave="reader-sprite-leave"
                >
                  {{ t('empty.noSprite') }}
                </div>
              }
            }
          </div>
        }

        @switch (layout()) {
          @case ('dialog') {
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
  readonly continuation = input<SceneContinuation | null>(null);
  readonly inlineRefOptions = input<InlineRefOption[]>([]);
  readonly textSpeed = input<TextSpeed>('fast');
  readonly cardVariant = input<'floating' | 'page'>('floating');
  readonly cardHidden = input<boolean>(false);
  readonly spritesHidden = input<boolean>(false);
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
        : MAX_SLOTS;
    const capacity = Math.min(MAX_SLOTS, Math.max(1, fitsByWidth));
    if (ordered.length <= capacity) return ordered;
    const byPriority = [...ordered].sort(
      (a, b) => Number(b.isSpeaker) - Number(a.isSpeaker),
    );
    const kept = new Set(byPriority.slice(0, capacity).map((s) => s.id));
    return ordered.filter((s) => kept.has(s.id));
  });

  protected readonly placedStaged = computed(() => {
    const visible = this.visibleStaged();
    const centers = SLOT_CENTERS_BY_COUNT[visible.length] ?? [];
    return visible.map((s, i) => ({
      ...s,
      leftPercent: centers[i] ?? 50,
      transform:
        s.facing === 'left'
          ? 'translateX(-50%) scaleX(-1)'
          : 'translateX(-50%)',
    }));
  });

  playEnterTransition(durationMs: number): void {
    this.foreground()?.nativeElement.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: durationMs, easing: 'ease-out' },
    );
  }

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

  protected onArticleClick(event: MouseEvent): void {
    if (this.layout() === 'showcase') {
      const next = this.choices();
      if (next.length === 1) this.choose.emit(next[0].sceneId);
      return;
    }
    if (this.cardHidden()) return;
    const tw = this.typewriter();
    if (!tw) return;
    const completed = tw.complete();
    if (completed) event.stopPropagation();
  }
}
