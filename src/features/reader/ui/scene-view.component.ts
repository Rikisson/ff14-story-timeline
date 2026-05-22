import {
  AnimationCallbackEvent,
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
  untracked,
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

type PlacedSprite = StagedView & { leftPercent: number; transform: string };

const POSITION_RANK: Record<string, number> = { left: 0, center: 1, right: 2 };

const MIN_STAGE_WIDTH_PER_SPRITE = 0.5;

const MAX_SLOTS = 3;
const SLOT_CENTERS_BY_COUNT: Record<number, readonly number[]> = {
  1: [50],
  2: [30, 70],
  3: [25, 50, 75],
};

// Speaker labels sit at the speaker's sprite slot, spread out from the
// centre by this factor so the left/right labels clear the middle more.
const LABEL_SPREAD = 1.5;

const SPRITE_ANIM_CLASSES = [
  'reader-sprite-fade-in',
  'reader-sprite-fade-out',
  'reader-sprite-pop-in',
];

// How long a sprite swap waits when the same scene change also moves
// sprites, so the slide settles before the swap pop runs.
const SWAP_HOLD_MS = 300;

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
        <div
          class="reader-stage pointer-events-none absolute inset-0"
          [class.reader-stage-hidden]="spritesHidden()"
        >
          <!-- keyed on id + sprite URL so a sprite swap animates as leave + enter -->
          @for (s of displayStaged(); track s.id + '|' + s.spriteUrl) {
            @if (s.spriteUrl; as url) {
              <img
                [src]="url"
                [alt]="s.name"
                class="reader-sprite reader-sprite-hidden absolute bottom-0 h-[88%] w-auto object-contain"
                [class.reader-sprite-muted]="!s.isSpeaker"
                [attr.data-sprite-id]="s.id"
                [style.left.%]="s.leftPercent"
                [style.transform]="s.transform"
                (animate.enter)="onSpriteEnter($event, s.id)"
                (animate.leave)="onSpriteLeave($event, s.id)"
              />
            }
          }
        </div>

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
              @for (label of speakerLabels(); track 'speaker') {
                <div
                  class="reader-card-speaker"
                  [style.left.%]="label.leftPercent"
                  animate.enter="reader-sprite-fade-in"
                  animate.leave="reader-sprite-fade-out"
                >
                  <span>{{ label.text }}</span>
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
                <p class="m-0 text-center font-display text-3xl font-semibold leading-tight text-scrim-foreground drop-shadow-[0_4px_18px_rgb(0_0_0/0.65)] sm:text-4xl md:text-5xl">
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

  readonly choose = output<string>();

  protected readonly speakerLabels = computed(() => {
    const text = this.speaker();
    if (!text) return [];
    const slot = this.displayStaged().find((s) => s.isSpeaker)?.leftPercent ?? 50;
    return [{ text, leftPercent: 50 + (slot - 50) * LABEL_SPREAD }];
  });

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

  private readonly placedStaged = computed<PlacedSprite[]>(() => {
    const visible = this.visibleStaged();
    const centers = SLOT_CENTERS_BY_COUNT[visible.length] ?? [];
    return visible.map((s, i) => ({
      ...s,
      leftPercent: centers[i] ?? 50,
      transform: s.facing === 'left' ? 'scaleX(-1)' : '',
    }));
  });

  // What the template renders: tracks `placedStaged`, but holds a
  // sprite-URL swap back until a concurrent slide/fade settles.
  protected readonly displayStaged = signal<PlacedSprite[]>([]);
  private holdTimer?: ReturnType<typeof setTimeout>;

  private readonly pendingTimers = new Set<ReturnType<typeof setTimeout>>();

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

    effect(() => {
      const target = this.placedStaged();
      untracked(() => this.reconcileDisplay(target));
    });

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.holdTimer);
      for (const timer of this.pendingTimers) clearTimeout(timer);
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

  protected onSpriteEnter(event: AnimationCallbackEvent, id: string): void {
    const el = event.target as HTMLElement;
    el.classList.remove('reader-sprite-hidden');
    const swap = this.stagedElementCount(el, id) > 1;
    this.playSpriteAnim(event, swap ? 'reader-sprite-pop-in' : 'reader-sprite-fade-in');
  }

  protected onSpriteLeave(event: AnimationCallbackEvent, id: string): void {
    const swap = this.displayStaged().some((p) => p.id === id);
    if (!swap) {
      this.playSpriteAnim(event, 'reader-sprite-fade-out');
      return;
    }
    // A swapped-out sprite is dropped at once — the incoming pop-in
    // covers it. Removal is deferred a tick so the element outlives the
    // incoming sprite's swap detection (a same-id count in the DOM).
    (event.target as HTMLElement).classList.add('reader-sprite-hidden');
    let timer: ReturnType<typeof setTimeout>;
    const release = () => {
      this.pendingTimers.delete(timer);
      event.animationComplete();
    };
    timer = setTimeout(release, 0);
    this.pendingTimers.add(timer);
  }

  private stagedElementCount(el: HTMLElement, id: string): number {
    const siblings = el.parentElement?.children;
    if (!siblings) return 1;
    let count = 0;
    for (const child of Array.from(siblings)) {
      if ((child as HTMLElement).dataset['spriteId'] === id) count++;
    }
    return count;
  }

  private playSpriteAnim(event: AnimationCallbackEvent, animationClass: string): void {
    const el = event.target as HTMLElement;
    el.classList.remove(...SPRITE_ANIM_CLASSES);
    el.classList.add(animationClass);
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      this.pendingTimers.delete(timer);
      event.animationComplete();
    };
    el.addEventListener('animationend', finish, { once: true });
    timer = setTimeout(finish, 400);
    this.pendingTimers.add(timer);
  }

  private reconcileDisplay(target: PlacedSprite[]): void {
    clearTimeout(this.holdTimer);
    const shown = this.displayStaged();
    const deferSwap =
      this.spritesChanged(shown, target) && this.layoutChanged(shown, target);
    if (!deferSwap) {
      this.displayStaged.set(target);
      return;
    }
    this.displayStaged.set(this.withHeldSprites(target, shown));
    this.holdTimer = setTimeout(
      () => this.displayStaged.set(this.placedStaged()),
      SWAP_HOLD_MS,
    );
  }

  private layoutChanged(shown: PlacedSprite[], target: PlacedSprite[]): boolean {
    if (shown.length !== target.length) return true;
    const byId = new Map(shown.map((s) => [s.id, s] as const));
    return target.some((s) => byId.get(s.id)?.leftPercent !== s.leftPercent);
  }

  private spritesChanged(shown: PlacedSprite[], target: PlacedSprite[]): boolean {
    const byId = new Map(shown.map((s) => [s.id, s] as const));
    return target.some((s) => {
      const prev = byId.get(s.id);
      return prev !== undefined && prev.spriteUrl !== s.spriteUrl;
    });
  }

  private withHeldSprites(
    target: PlacedSprite[],
    shown: PlacedSprite[],
  ): PlacedSprite[] {
    const byId = new Map(shown.map((s) => [s.id, s] as const));
    return target.map((s) => {
      const prev = byId.get(s.id);
      return prev ? { ...s, spriteUrl: prev.spriteUrl } : s;
    });
  }
}
