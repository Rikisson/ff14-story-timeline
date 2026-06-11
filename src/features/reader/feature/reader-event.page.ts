import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  Connection,
  ConnectionsService,
  entityKeyOf,
  sourceEntityRef,
  targetEntityRef,
} from '@features/connections';
import { EventsService, TimelineEvent } from '@features/events';
import { UniverseStore } from '@features/universes';
import {
  AssetThumbResolver,
  EntityDirectoryService,
  EntityResolverCache,
  LayoutStore,
  ResolvedDirectoryRow,
} from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { ReaderPreferencesService } from '@shared/services';
import { SecondaryButtonComponent } from '@shared/ui';
import { InlineRefOption, parseRefs } from '@shared/utils';
import { ReaderReferrerService } from '../data-access/reader-referrer.service';
import { resolveEffectiveTextSpeed } from '../data-access/text-speed';
import { BackOption, ReaderBackMenuComponent } from '../ui/reader-back-menu.component';
import { ReaderPreferencesDialogComponent } from '../ui/reader-preferences-dialog.component';
import { SceneContinuation, SceneViewComponent } from '../ui/scene-view.component';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';
import { BgmController } from './bgm-controller';
import { ReaderLeavable } from './reader-leave.guard';
import {
  createChromeIdle,
  createDeferredFlag,
  createReaderFade,
  createReducedMotion,
  EXIT_FADE_MS,
  REDUCED_MOTION_EXIT_MS,
  registerAutoplayUnblock,
} from './reader-page-behaviors';

/**
 * Single-frame reader for `TimelineEvent`. Renders the event's
 * description as a dialog-style scene-view, with the cover image as the
 * background and BGM piped through a fresh `BgmController`. There's no
 * scene graph, no choices, no localStorage progress. The first entry of
 * the event's outbound connection (if any) becomes a Continue anchor
 * inside the floating card.
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
    ReaderBackMenuComponent,
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
      <div [class]="rootClass()" [style.--reader-card-opacity]="prefs.textBoxOpacity()">
        <!-- Page-level fade. The reader content fades as one over the
             root's static bg-canvas; nothing canvas-colored is ever
             composited, so an imageless event fades seam-free. Input is
             held off by the transparent blocker below. -->
        <div
          class="absolute inset-0 transition-opacity ease-in-out"
          [style.opacity]="fade.opacity()"
          [style.transition-duration.ms]="fade.durationMs()"
        >
          @if (loading()) {
            @if (showLoadingIndicator()) {
              <p class="mx-auto w-full max-w-7xl px-4 pt-4 text-foreground-subtle">{{ t('message.loading') }}</p>
            }
          } @else if (error(); as err) {
            <div class="mx-auto w-full max-w-7xl px-4 pt-4">
              <p class="text-danger-foreground">{{ err }}</p>
              <p><a routerLink="/explore" class="text-accent hover:underline">{{ t('action.backToTimeline') }}</a></p>
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
              [continuationBroken]="continuationBroken()"
              [inlineRefOptions]="inlineRefOptions()"
              [textSpeed]="effectiveTextSpeed()"
              cardVariant="page"
              [cardHidden]="cardHidden()"
              (continuationFollowed)="onContinuationFollowed()"
            />

            <div
              class="pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-300 ease-out"
              [class.opacity-0]="chromeIdle()"
              [class.pointer-events-none]="chromeIdle()"
              [attr.aria-hidden]="chromeIdle() ? 'true' : null"
            >
              <header #headerEl class="mx-auto flex w-full max-w-7xl px-4 pt-3">
                <div class="pointer-events-auto flex w-full items-center gap-3 rounded-lg border border-border bg-surface/75 px-4 py-2 shadow-lg backdrop-blur-sm">
                  <h1 class="m-0 min-w-0 flex-1 truncate font-display text-2xl font-semibold text-foreground">{{ ev.name }}</h1>
                  <div class="flex items-center gap-2">
                    <app-reader-back-menu
                      [canGoBack]="false"
                      [options]="backOptions()"
                      (navigated)="onBackNavigated()"
                    />
                    <button
                      uiSecondary
                      type="button"
                      [attr.aria-pressed]="cardHidden()"
                      [class.reader-toggle-active]="cardHidden()"
                      [attr.aria-label]="cardHidden() ? t('action.showText') : t('action.hideText')"
                      (click)="cardHidden.set(!cardHidden())"
                    >
                      {{ t('action.textBoxEmoji') }}
                    </button>
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
                      [attr.aria-pressed]="layout.browserFullscreen()"
                      [class.reader-toggle-active]="layout.browserFullscreen()"
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

        <!-- Transparent input blocker — swallows taps while the page
             fade is animating. Transparent, so it adds no color. -->
        @if (inputBlocked()) {
          <div class="absolute inset-0 z-40" aria-hidden="true"></div>
        }
      </div>

      <app-reader-preferences-dialog #prefsDialog />
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderEventPage implements ReaderLeavable {
  readonly id = input.required<string>();

  private readonly events = inject(EventsService);
  private readonly transloco = inject(TranslocoService);
  private readonly assets = inject(AssetThumbResolver);
  private readonly resolver = inject(EntityResolverCache);
  private readonly connections = inject(ConnectionsService);
  private readonly directory = inject(EntityDirectoryService);
  private readonly universes = inject(UniverseStore);
  private readonly referrer = inject(ReaderReferrerService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prefs = inject(ReaderPreferencesService);
  protected readonly layout = inject(LayoutStore);

  private readonly headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');
  private readonly bgmA = viewChild<ElementRef<HTMLAudioElement>>('bgmA');
  private readonly bgmB = viewChild<ElementRef<HTMLAudioElement>>('bgmB');
  private bgmController: BgmController | null = null;

  protected readonly event = signal<TimelineEvent | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  // Delay-gated "Loading…" line — see `createDeferredFlag`.
  protected readonly showLoadingIndicator = createDeferredFlag(this.loading);

  // Idle-fade state for the floating header — see `createChromeIdle`.
  protected readonly chromeIdle = createChromeIdle(this.headerEl);

  // OS-level reduced-motion preference — see `createReducedMotion`.
  protected readonly reducedMotion = createReducedMotion();

  // Page-level fade transition — fades the reader in on entry and on an
  // event→event continuation (which reuses this component, keyed on
  // `id`); the leave guard's `beginExit()` fades it back out.
  protected readonly fade = createReaderFade(this.reducedMotion, this.id);

  // True while the page fade is animating — the transparent blocker
  // uses it to swallow input.
  protected readonly inputBlocked = this.fade.blocksInput;

  // `bg-canvas` is the static page background the fade wrapper animates
  // over — see `createReaderFade`.
  protected readonly rootClass = computed(
    () => `reader-font-${this.prefs.fontSize()} relative h-full bg-canvas`,
  );

  // Hide-text toggle. Persists across reloads of the single event frame;
  // the card returns only via this header toggle — a scene click while
  // it is hidden does nothing. Events carry no staged characters, so
  // there is no hide-sprites counterpart.
  protected readonly cardHidden = signal(false);

  protected toggleFullscreen(): void {
    if (this.layout.browserFullscreen()) {
      void this.layout.exitFullscreen();
    } else {
      void this.layout.enterFullscreen();
    }
  }

  /**
   * Leave-guard hook (`ReaderLeavable`). Fades the reader's visuals and
   * BGM out before the route is torn down, so leaving the event — for a
   * continuation or back out of the reader — never cuts abruptly.
   * Always resolves true: the guard only delays, never blocks. Idempotent
   * within one navigation — `fade.fadeOut()` caches its in-flight fade.
   */
  beginExit(): Promise<boolean> {
    const audioMs = this.reducedMotion() ? REDUCED_MOTION_EXIT_MS : EXIT_FADE_MS;
    return Promise.all([
      this.fade.fadeOut(),
      this.bgmController?.fadeOutAndStop(audioMs) ?? Promise.resolve(),
    ]).then(() => true);
  }

  // Events carry no per-scene `textSpeed`, so the shared helper resolves
  // to the global fast/instant default — kept in lockstep with the story
  // reader by going through `resolveEffectiveTextSpeed`.
  protected readonly effectiveTextSpeed = computed(() =>
    resolveEffectiveTextSpeed(null, {
      allowTextAnimations: this.prefs.allowTextAnimations() && !this.reducedMotion(),
    }),
  );

  // Background resolves directly from the event's cover. No story-level
  // fallback because events stand alone — when no cover is set the
  // article shows its canvas color the same way a coverless story does.
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

  // Connections for the loaded event: at most one outbound (the event
  // is a single source endpoint) plus any inbound, fetched once per
  // event with the directory rows of every endpoint. A wired target
  // with no public row renders the soft "no longer available" notice.
  private connectionsSeq = 0;
  private readonly connectionsState = signal<{
    eventId: string;
    outbound: Connection[];
    inbound: Connection[];
    rows: Map<string, ResolvedDirectoryRow>;
  } | null>(null);

  private async loadConnections(eventId: string, seq: number): Promise<void> {
    try {
      const entity = { kind: 'event', id: eventId } as const;
      const [outbound, inbound] = await Promise.all([
        this.connections.outboundFor(entity, { readerOnly: true }),
        this.connections.inboundFor(entity, { readerOnly: true }),
      ]);
      const refs: EntityRef[] = [];
      for (const c of outbound) {
        const target = targetEntityRef(c.to);
        if (target) refs.push(target);
      }
      for (const c of inbound) refs.push(sourceEntityRef(c.from));
      const universeId = this.universes.activeUniverseId();
      const rows = new Map<string, ResolvedDirectoryRow>();
      if (universeId && refs.length > 0) {
        const resolved = await this.directory.byIds({ universeId, refs });
        for (const row of resolved) rows.set(`${row.kind}:${row.id}`, row);
      }
      if (seq !== this.connectionsSeq) return;
      this.connectionsState.set({ eventId, outbound, inbound, rows });
    } catch {
      if (seq !== this.connectionsSeq) return;
      this.connectionsState.set({ eventId, outbound: [], inbound: [], rows: new Map() });
    }
  }

  private readonly outboundConnection = computed<Connection | null>(() => {
    const state = this.connectionsState();
    const ev = this.event();
    if (!state || !ev || state.eventId !== ev.id) return null;
    return state.outbound.find((c) => c.to !== null) ?? null;
  });
  protected readonly continuation = computed<SceneContinuation | null>(() => {
    const conn = this.outboundConnection();
    const state = this.connectionsState();
    if (!conn?.to || !state) return null;
    const ref = targetEntityRef(conn.to);
    if (!ref) return null;
    const row = state.rows.get(entityKeyOf(ref));
    if (!row) return null;
    return {
      label: row.label,
      labelKey: 'continuesIn',
      link: [ref.kind === 'story' ? '/reader/story' : '/reader/event', ref.id] as const,
      queryParams:
        conn.to.kind === 'story' && conn.to.sceneId ? { scene: conn.to.sceneId } : undefined,
    };
  });
  protected readonly continuationBroken = computed<boolean>(() => {
    const conn = this.outboundConnection();
    const state = this.connectionsState();
    if (!conn?.to || !state) return false;
    const ref = targetEntityRef(conn.to);
    return ref !== null && !state.rows.has(entityKeyOf(ref));
  });

  protected onContinuationFollowed(): void {
    const ev = this.event();
    if (!ev) return;
    this.referrer.set({ kind: 'event', id: ev.id, label: ev.name });
  }

  protected readonly backOptions = computed<BackOption[]>(() => {
    const ev = this.event();
    const state = this.connectionsState();
    if (!ev) return [];
    const options: BackOption[] = [];
    const seen = new Set<string>();
    const ref = this.referrer.current();
    if (ref && !(ref.kind === 'event' && ref.id === ev.id)) {
      const key = `${ref.kind}:${ref.id}`;
      options.push({
        key,
        label: ref.label,
        link: [ref.kind === 'story' ? '/reader/story' : '/reader/event', ref.id] as const,
        queryParams: ref.sceneId ? { scene: ref.sceneId } : undefined,
        highlighted: true,
      });
      seen.add(key);
    }
    if (state && state.eventId === ev.id) {
      for (const c of state.inbound) {
        const srcRef = sourceEntityRef(c.from);
        const key = entityKeyOf(srcRef);
        if (seen.has(key)) continue;
        const row = state.rows.get(key);
        if (!row) continue;
        seen.add(key);
        options.push({
          key,
          label: row.label,
          link: [srcRef.kind === 'story' ? '/reader/story' : '/reader/event', srcRef.id] as const,
          queryParams: c.from.kind === 'story' ? { scene: c.from.sceneId } : undefined,
        });
      }
    }
    return options;
  });

  protected onBackNavigated(): void {
    this.referrer.clear();
  }

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
              ? this.transloco.translate('reader.message.eventUnavailable')
              : err instanceof Error
                ? `${err.name}: ${err.message}`
                : String(err);
          this.error.set(message);
          this.loading.set(false);
        },
      );
    });

    this.destroyRef.onDestroy(() => {
      this.bgmController?.dispose();
    });

    // Fetch the event's connections once per loaded event.
    effect(() => {
      const ev = this.event();
      if (!ev) return;
      const seq = ++this.connectionsSeq;
      untracked(() => void this.loadConnections(ev.id, seq));
    });

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

    // Autoplay unblock — keep every gesture wired to the controller so
    // playback can recover if it was built outside a gesture frame and
    // the browser blocked its initial play().
    registerAutoplayUnblock(() => this.bgmController?.unblock());
  }
}
