import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { EventsService, TimelineEvent } from '@features/events';
import { AssetThumbResolver, EntityResolverCache, LayoutStore } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { ReaderPreferencesService } from '@shared/services';
import { SecondaryButtonComponent } from '@shared/ui';
import { InlineRefOption, parseRefs } from '@shared/utils';
import { ReaderPreferencesDialogComponent } from '../ui/reader-preferences-dialog.component';
import { SceneContinuation, SceneViewComponent } from '../ui/scene-view.component';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';
import { BgmController } from './bgm-controller';

const OVERFLOW_DESCRIPTION_THRESHOLD = 600;

/**
 * Single-frame reader for `TimelineEvent`. Renders the event's
 * description as a dialog-style scene-view, with the cover image as the
 * background and BGM piped through a fresh `BgmController`. There's no
 * scene graph, no choices, no localStorage progress. The first entry of
 * `event.nextRefs` (if any) becomes a Continue anchor inside the
 * floating card.
 *
 * Chrome (title bar + buttons) shows on load, hides after 2.5s, and
 * re-appears only while the pointer hovers the top zone — matching the
 * story reader.
 */
@Component({
  selector: 'app-reader-event-page',
  host: { class: 'block h-full' },
  imports: [
    RouterLink,
    SceneViewComponent,
    ReaderPreferencesDialogComponent,
    SecondaryButtonComponent,
    TranslocoDirective,
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
      <div [class]="rootClass()">
        @if (loading()) {
          @if (showLoadingIndicator()) {
            <p class="mx-auto w-full max-w-7xl px-4 pt-4 text-foreground-subtle">{{ t('message.loading') }}</p>
          }
        } @else if (error(); as err) {
          <div class="mx-auto w-full max-w-7xl px-4 pt-4">
            <p class="text-danger-foreground">{{ err }}</p>
            <p><a routerLink="/library" class="text-accent hover:underline">{{ t('action.backToCatalog') }}</a></p>
          </div>
        } @else if (event(); as ev) {
          <app-scene-view
            class="absolute inset-0"
            layout="dialog"
            [text]="ev.description"
            [background]="backgroundUrl()"
            [backgroundBlurDataUrl]="backgroundBlurDataUrl()"
            [backgroundEffect]="ev.backgroundEffect"
            [staged]="[]"
            [choices]="[]"
            [continuation]="continuation()"
            [inlineRefOptions]="inlineRefOptions()"
            [textSpeed]="effectiveTextSpeed()"
            [cardOverflow]="cardOverflow()"
          />

          <div
            class="pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-300 ease-out"
            [class.opacity-0]="chromeIdle()"
            [class.pointer-events-none]="chromeIdle()"
            [attr.aria-hidden]="chromeIdle() ? 'true' : null"
          >
            <header #headerEl class="mx-auto flex w-full max-w-7xl px-4 pt-3">
              <div class="pointer-events-auto flex w-full items-center gap-3 rounded-lg border border-border bg-surface/90 px-4 py-2 shadow-lg backdrop-blur-sm">
                <h1 class="m-0 min-w-0 flex-1 truncate text-xl font-semibold text-foreground">{{ ev.name }}</h1>
                <div class="flex items-center gap-2">
                  <a routerLink="/library" class="text-sm text-foreground-subtle hover:underline">{{ t('action.catalog') }}</a>
                  <button
                    uiSecondary
                    type="button"
                    [attr.aria-label]="t('action.preferences')"
                    (click)="prefsDialog.open()"
                  >
                    {{ t('action.preferencesEmoji') }}
                  </button>
                  <button
                    uiSecondary
                    type="button"
                    [attr.aria-label]="layout.browserFullscreen() ? t('action.exitFullscreen') : t('action.enterFullscreen')"
                    (click)="toggleFullscreen()"
                  >
                    {{ t('action.fullscreenEmoji') }}
                  </button>
                </div>
              </div>
            </header>
          </div>

          <!-- BGM pair only — events don't carry SFX per the schema. -->
          <audio #bgmA class="sr-only" loop preload="auto" aria-hidden="true"></audio>
          <audio #bgmB class="sr-only" loop preload="auto" aria-hidden="true"></audio>
        }
      </div>

      <app-reader-preferences-dialog #prefsDialog />
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderEventPage {
  readonly id = input.required<string>();

  private readonly events = inject(EventsService);
  private readonly transloco = inject(TranslocoService);
  private readonly assets = inject(AssetThumbResolver);
  private readonly resolver = inject(EntityResolverCache);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly prefs = inject(ReaderPreferencesService);
  protected readonly layout = inject(LayoutStore);

  private readonly headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');
  private readonly bgmA = viewChild<ElementRef<HTMLAudioElement>>('bgmA');
  private readonly bgmB = viewChild<ElementRef<HTMLAudioElement>>('bgmB');
  private bgmController: BgmController | null = null;

  protected readonly event = signal<TimelineEvent | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showLoadingIndicator = signal(false);

  // Idle-fade chrome — same 2.5s contract as the story reader.
  private static readonly CHROME_IDLE_MS = 2500;
  protected readonly chromeIdle = signal(false);

  protected readonly reducedMotion = signal(false);

  protected readonly rootClass = computed(
    () => `reader-font-${this.prefs.fontSize()} relative h-full`,
  );

  protected toggleFullscreen(): void {
    if (this.layout.browserFullscreen()) {
      void this.layout.exitFullscreen();
    } else {
      void this.layout.enterFullscreen();
    }
  }

  protected readonly effectiveTextSpeed = computed(() => {
    const allow = this.prefs.allowTextAnimations() && !this.reducedMotion();
    return allow ? 'fast' : 'instant';
  });

  // Background resolves directly from the event's cover. No story-level
  // fallback because events stand alone — when no cover is set the
  // article shows its surface color the same way a coverless story does.
  private readonly backgroundThumb = computed(() =>
    this.assets.resolve(this.event()?.coverAssetId)(),
  );
  protected readonly backgroundUrl = computed(() => this.backgroundThumb()?.url);
  protected readonly backgroundBlurDataUrl = computed(() => this.backgroundThumb()?.blurDataUrl);

  // BGM target is the lone authored asset; no story-default inheritance.
  // Crossfade transition is the safe default for entering/leaving.
  private readonly bgmThumb = computed(() =>
    this.assets.resolve(this.event()?.bgmAssetId)(),
  );
  private readonly bgmUrl = computed(() => this.bgmThumb()?.url ?? null);

  // Inline-ref resolution — same shape as `reader-story.page.ts` but
  // sourced from the event's description rather than the current scene.
  private readonly inlineRefs = computed<EntityRef[]>(() => {
    const text = this.event()?.description ?? '';
    const seen = new Set<string>();
    const out: EntityRef[] = [];
    for (const seg of parseRefs(text)) {
      if (!('ref' in seg)) continue;
      const key = `${seg.ref.kind}:${seg.ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(seg.ref);
    }
    return out;
  });
  private readonly resolvedInlineRefs = this.resolver.resolveMany(this.inlineRefs);
  protected readonly inlineRefOptions = computed<InlineRefOption[]>(() => {
    const resolved = this.resolvedInlineRefs();
    const out: InlineRefOption[] = [];
    for (const r of this.inlineRefs()) {
      const row = resolved.get(`${r.kind}:${r.id}`);
      if (!row) continue;
      out.push({ kind: r.kind, id: r.id, label: row.label, slug: row.slug });
    }
    return out;
  });

  protected readonly cardOverflow = computed(
    () => (this.event()?.description.length ?? 0) > OVERFLOW_DESCRIPTION_THRESHOLD,
  );

  // Continuation reads the first entry of `nextRefs[]` — editors cap
  // selection to one but the schema preserves the array shape. The
  // anchor renders inside the floating card via scene-view, taking
  // the resolved entity's title as its label.
  private readonly continuationRef = computed(() => this.event()?.nextRefs?.[0] ?? null);
  private readonly resolvedContinuation = computed(() => {
    const ref = this.continuationRef();
    return ref ? this.resolver.resolve(ref)() : null;
  });
  protected readonly continuation = computed<SceneContinuation | null>(() => {
    const ref = this.continuationRef();
    const row = this.resolvedContinuation();
    if (!ref || !row) return null;
    const base = ref.kind === 'story' ? '/reader/story' : '/reader/event';
    return { label: row.label, link: [base, ref.id] as const };
  });

  constructor() {
    // Stale-response guard — fast id swaps could otherwise overwrite the
    // latest fetch with an older one. Only the most recent seq wins.
    let loadSeq = 0;
    effect(() => {
      const id = this.id();
      const seq = ++loadSeq;
      this.loading.set(true);
      this.error.set(null);
      this.events.getById(id).then(
        (e) => {
          if (seq !== loadSeq) return;
          if (!e) {
            this.error.set(`Event not found: ${id}`);
            this.loading.set(false);
            return;
          }
          this.event.set(e);
          this.loading.set(false);
        },
        (err: unknown) => {
          if (seq !== loadSeq) return;
          const message =
            err instanceof FirebaseError && err.code === 'permission-denied'
              ? this.transloco.translate('reader.message.storyUnavailable')
              : err instanceof Error
                ? `${err.name}: ${err.message}`
                : String(err);
          this.error.set(message);
          this.loading.set(false);
        },
      );
    });

    // 500 ms loading-indicator deferral — same pattern as the story
    // page so cached events don't flash a "Loading…" line.
    let pendingIndicator: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const loading = this.loading();
      if (pendingIndicator !== null) {
        clearTimeout(pendingIndicator);
        pendingIndicator = null;
      }
      if (loading) {
        this.showLoadingIndicator.set(false);
        pendingIndicator = setTimeout(() => {
          this.showLoadingIndicator.set(true);
          pendingIndicator = null;
        }, 500);
      } else {
        this.showLoadingIndicator.set(false);
      }
    });
    this.destroyRef.onDestroy(() => {
      if (pendingIndicator !== null) clearTimeout(pendingIndicator);
      this.bgmController?.dispose();
      void this.layout.exitFullscreen();
    });

    if (this.isBrowser) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.set(mq.matches);
      const onChange = (e: MediaQueryListEvent): void => this.reducedMotion.set(e.matches);
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }

    // Chrome reveal: floating header shows on load, hides after
    // `CHROME_IDLE_MS`, and re-appears only while the pointer is in
    // the top hover zone — header's top padding + card + equal pad
    // below. Mirrors the story reader.
    if (this.isBrowser) {
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      const FALLBACK_HOVER_PX = 82;
      const startHideTimer = (): void => {
        if (idleTimer !== null) clearTimeout(idleTimer);
        idleTimer = setTimeout(
          () => this.chromeIdle.set(true),
          ReaderEventPage.CHROME_IDLE_MS,
        );
      };
      const hoverZone = (): number => {
        const el = this.headerEl()?.nativeElement;
        if (!el) return FALLBACK_HOVER_PX;
        const rect = el.getBoundingClientRect();
        const topPad = parseFloat(getComputedStyle(el).paddingTop) || 0;
        return rect.bottom + topPad;
      };
      const onMouseMove = (e: MouseEvent): void => {
        if (e.clientY <= hoverZone()) {
          this.chromeIdle.set(false);
          if (idleTimer !== null) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
        } else if (!this.chromeIdle() && idleTimer === null) {
          startHideTimer();
        }
      };
      startHideTimer();
      document.addEventListener('mousemove', onMouseMove, { passive: true });
      this.destroyRef.onDestroy(() => {
        if (idleTimer !== null) clearTimeout(idleTimer);
        document.removeEventListener('mousemove', onMouseMove);
      });
    }

    // Instantiate the BGM controller once both audio slots mount. Same
    // pattern as the story reader, minus SFX.
    effect(() => {
      const a = this.bgmA()?.nativeElement;
      const b = this.bgmB()?.nativeElement;
      if (!a || !b) return;
      if (this.bgmController) return;
      const controller = new BgmController(a, b);
      this.bgmController = controller;
      untracked(() => {
        controller.setUserVolume(this.prefs.bgmVolume());
        controller.setTarget({ assetId: this.event()?.bgmAssetId ?? null, transition: 'crossfade' }, this.bgmUrl());
      });
    });

    effect(() => {
      const url = this.bgmUrl();
      const assetId = this.event()?.bgmAssetId ?? null;
      this.bgmController?.setTarget({ assetId, transition: 'crossfade' }, url);
    });
    effect(() => {
      const v = this.prefs.bgmVolume();
      this.bgmController?.setUserVolume(v);
    });

    // First-user-gesture autoplay unblock. Mirrors the story page so a
    // browser that blocked the initial BGM `play()` picks up on the
    // first click/key the reader makes.
    if (this.isBrowser) {
      const onFirstGesture = (): void => {
        this.bgmController?.unblock();
        document.removeEventListener('pointerdown', onFirstGesture, true);
        document.removeEventListener('keydown', onFirstGesture, true);
      };
      document.addEventListener('pointerdown', onFirstGesture, true);
      document.addEventListener('keydown', onFirstGesture, true);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('pointerdown', onFirstGesture, true);
        document.removeEventListener('keydown', onFirstGesture, true);
      });
    }
  }
}
