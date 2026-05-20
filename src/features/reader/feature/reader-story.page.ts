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
  Signal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { Character, CharactersService } from '@features/characters';
import { Scene } from '@features/stories';
import {
  AssetThumbResolver,
  EntityResolverCache,
  LayoutStore,
  ResolvedDirectoryRow,
} from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { ReaderPreferencesService } from '@shared/services';
import { GhostButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { InlineRefOption, parseRefs } from '@shared/utils';
import { resolveEffectiveBgm } from '../data-access/bgm';
import { ReaderStore } from '../data-access/reader.store';
import { resolveEffectiveTextSpeed } from '../data-access/text-speed';
import { ReaderPreferencesDialogComponent } from '../ui/reader-preferences-dialog.component';
import { SceneContinuation, SceneViewComponent, StagedView } from '../ui/scene-view.component';
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
import { SfxController } from './sfx-controller';

@Component({
  selector: 'app-reader-story-page',
  host: { class: 'block h-full' },
  imports: [
    RouterLink,
    SceneViewComponent,
    ReaderPreferencesDialogComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
    TranslocoDirective,
  ],
  providers: [
    ReaderStore,
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
        @if (store.loading()) {
          @if (showLoadingIndicator()) {
            <p class="mx-auto w-full max-w-7xl px-4 pt-4 text-foreground-subtle">{{ t('message.loading') }}</p>
          }
        } @else if (store.error(); as err) {
          <div class="mx-auto w-full max-w-7xl px-4 pt-4">
            <p class="text-danger-foreground">{{ err }}</p>
            <p><a routerLink="/timeline" class="text-accent hover:underline">{{ t('action.backToTimeline') }}</a></p>
          </div>
        } @else if (store.story(); as story) {
          @if (store.currentScene(); as scene) {
            <app-scene-view
              class="absolute inset-0"
              [text]="scene.text"
              [layout]="scene.layout ?? 'dialog'"
              [speaker]="speakerLabel()"
              [speakerPosition]="speakerPosition()"
              [background]="backgroundUrl()"
              [backgroundBlurDataUrl]="backgroundBlurDataUrl()"
              [backgroundEffect]="scene.backgroundEffect"
              [staged]="stagedView()"
              [choices]="scene.next"
              [continuation]="continuation()"
              [inlineRefOptions]="inlineRefOptions()"
              [textSpeed]="effectiveTextSpeed()"
              [cardHidden]="cardHidden()"
              [spritesHidden]="spritesHidden()"
              [revealEnabled]="fade.ready()"
              (choose)="advance($event)"
            />
          }

          <!-- Scene fade-through-black transition overlay. Runs through
               the theme surface color; opacity is driven by the
               advance/goBack orchestrator and the duration is the
               scene's half-transition time. -->
          <div
            class="absolute inset-0 z-20 bg-surface transition-opacity ease-in-out"
            [class.opacity-0]="!fadingToBlack()"
            [class.opacity-100]="fadingToBlack()"
            [class.pointer-events-none]="!fadingToBlack()"
            [style.transition-duration.ms]="blackoutMs()"
            aria-hidden="true"
          ></div>

          <div
            class="pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-300 ease-out"
            [class.opacity-0]="chromeIdle()"
            [class.pointer-events-none]="chromeIdle()"
            [attr.aria-hidden]="chromeIdle() ? 'true' : null"
          >
            <header #headerEl class="mx-auto flex w-full max-w-7xl px-4 pt-3">
              <div class="pointer-events-auto flex w-full items-center gap-3 rounded-lg border border-border bg-surface/90 px-4 py-2 shadow-lg backdrop-blur-sm">
                <h1 class="m-0 min-w-0 flex-1 truncate text-xl font-semibold text-foreground">{{ story.title }}</h1>
                <div class="flex items-center gap-2">
                  @if (store.resumedFromSave()) {
                    <button uiSecondary type="button" (click)="store.restart()">{{ t('action.startOver') }}</button>
                  }
                  <button
                    uiGhost
                    type="button"
                    [disabled]="!store.canGoBack()"
                    (click)="goBack()"
                  >
                    {{ t('action.back') }}
                  </button>
                  <button
                    uiSecondary
                    type="button"
                    [attr.aria-pressed]="cardHidden()"
                    [class.reader-toggle-active]="cardHidden() && !isShowcaseScene()"
                    [attr.aria-label]="cardHidden() ? t('action.showText') : t('action.hideText')"
                    [disabled]="isShowcaseScene()"
                    (click)="cardHidden.set(!cardHidden())"
                  >
                    {{ t('action.textBoxEmoji') }}
                  </button>
                  <button
                    uiSecondary
                    type="button"
                    [attr.aria-pressed]="spritesHidden()"
                    [class.reader-toggle-active]="spritesHidden()"
                    [attr.aria-label]="spritesHidden() ? t('action.showSprites') : t('action.hideSprites')"
                    (click)="spritesHidden.set(!spritesHidden())"
                  >
                    {{ t('action.spritesEmoji') }}
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

          <!--
            Audio host. Two hidden crossfade pairs sit at the shell
            level so they survive scene re-renders (per
            docs/narrative-engine-impl.md *Scene rendering layers*).
            BgmController loops the BGM pair; SfxController drives the
            one-shot SFX pair with autoplay + fade-in/out on every
            scene entry.
          -->
          <audio #bgmA class="sr-only" loop preload="auto" aria-hidden="true"></audio>
          <audio #bgmB class="sr-only" loop preload="auto" aria-hidden="true"></audio>
          <audio #sfxA class="sr-only" preload="auto" aria-hidden="true"></audio>
          <audio #sfxB class="sr-only" preload="auto" aria-hidden="true"></audio>
        }

        <!-- Page-level fade overlay (theme surface). Fades out on entry,
             back in on exit via the leave guard. Sits above the header
             (z-10) and the scene-transition overlay (z-20); swallows
             input while visible so a tap can't reach the scene
             mid-transition. -->
        <div
          class="absolute inset-0 z-30 bg-surface transition-opacity ease-in-out"
          [class.pointer-events-none]="!fade.blocksInput()"
          [style.opacity]="fade.opacity()"
          [style.transition-duration.ms]="fade.durationMs()"
          aria-hidden="true"
        ></div>
      </div>

      <app-reader-preferences-dialog #prefsDialog />
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderStoryPage implements ReaderLeavable {
  readonly id = input.required<string>();
  protected readonly store = inject(ReaderStore);
  private readonly characters = inject(CharactersService);
  private readonly assets = inject(AssetThumbResolver);
  private readonly resolver = inject(EntityResolverCache);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly prefs = inject(ReaderPreferencesService);
  protected readonly layout = inject(LayoutStore);

  private readonly headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');
  private readonly sceneView = viewChild(SceneViewComponent);
  private readonly bgmA = viewChild<ElementRef<HTMLAudioElement>>('bgmA');
  private readonly bgmB = viewChild<ElementRef<HTMLAudioElement>>('bgmB');
  private readonly sfxA = viewChild<ElementRef<HTMLAudioElement>>('sfxA');
  private readonly sfxB = viewChild<ElementRef<HTMLAudioElement>>('sfxB');
  private bgmController: BgmController | null = null;
  private sfxController: SfxController | null = null;

  // Monotonic counter that increments on every scene change (forward
  // *and* backward). Passed to SfxController.setTarget as the "scene
  // visit key" so re-entering a scene (e.g., back-nav onto the same
  // SFX URL) restarts playback from zero. Counter resets on full page
  // load, which is fine — uniqueness across the lifetime of one
  // reader session is all the controller needs.
  private readonly sceneEntryKey = signal(0);

  // Delay-gated "Loading…" line — a fast cache hit renders straight to
  // the scene with no flash. See `createDeferredFlag`.
  protected readonly showLoadingIndicator = createDeferredFlag(this.store.loading);

  // Idle-fade state for the floating header — see `createChromeIdle`.
  protected readonly chromeIdle = createChromeIdle(this.headerEl);

  // OS-level reduced-motion preference — collapses the typewriter to
  // instant regardless of `allowTextAnimations`. See `createReducedMotion`.
  protected readonly reducedMotion = createReducedMotion();

  // Page-level fade transition — fades the reader in on entry; the leave
  // guard's `beginExit()` fades it back out before any navigation away.
  protected readonly fade = createReaderFade(this.reducedMotion);

  protected readonly rootClass = computed(
    () => `reader-font-${this.prefs.fontSize()} relative h-full`,
  );

  // Reader header view toggles, persisted across scene changes. The card
  // returns only via the header text-box toggle — a scene click while it
  // is hidden does nothing (see scene-view).
  protected readonly cardHidden = signal(false);
  protected readonly spritesHidden = signal(false);

  // Scene-transition state. `fadingToBlack` drives the black overlay;
  // `blackoutMs` is its per-transition fade duration; `transitioning`
  // guards against overlapping navigations.
  protected readonly fadingToBlack = signal(false);
  protected readonly blackoutMs = signal(250);
  private readonly transitioning = signal(false);
  private readonly pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  // Latches once the leave guard has started the exit fade, so a second
  // guard call (e.g. a queued navigation) doesn't restart it.
  private exiting = false;

  protected readonly isShowcaseScene = computed(
    () => (this.store.currentScene()?.layout ?? 'dialog') === 'showcase',
  );

  // Speaker-name placement above the card follows the speaker's staged
  // slot; a narrator (string speaker) or an off-stage speaker centers.
  protected readonly speakerPosition = computed<'left' | 'center' | 'right'>(() => {
    const scene = this.store.currentScene();
    const sp = scene?.speaker;
    if (!scene || !sp || typeof sp === 'string') return 'center';
    const staged = scene.characters.find((c) => c.entity.id === sp.id);
    const pos = staged?.position;
    return pos === 'left' || pos === 'right' ? pos : 'center';
  });

  protected toggleFullscreen(): void {
    if (this.layout.browserFullscreen()) {
      void this.layout.exitFullscreen();
    } else {
      void this.layout.enterFullscreen();
    }
  }

  protected advance(targetId: string): void {
    const target = this.store.content()?.scenes[targetId];
    this.runTransition(target, () => this.store.choose(targetId));
  }

  protected goBack(): void {
    if (!this.store.canGoBack()) return;
    const history = this.store.history();
    const target = this.store.content()?.scenes[history[history.length - 2]];
    this.runTransition(target, () => this.store.back());
  }

  // Routes a navigation through the destination scene's transition.
  private runTransition(target: Scene | undefined, swap: () => void): void {
    if (this.transitioning()) return;
    const transition = target?.transition;
    // Instant cut when there's no transition or the OS asks for reduced motion.
    if (!transition || this.reducedMotion()) {
      swap();
      return;
    }
    const duration = clampTransitionMs(target?.transitionMs);
    if (transition === 'crossfade') {
      swap();
      this.sceneView()?.playEnterTransition(duration);
      return;
    }
    // fade-through-black: black in over the first half, swap under cover
    // of full black, then black back out.
    const half = Math.round(duration / 2);
    this.transitioning.set(true);
    this.blackoutMs.set(half);
    this.fadingToBlack.set(true);
    this.scheduleTimer(() => {
      swap();
      this.fadingToBlack.set(false);
      this.scheduleTimer(() => this.transitioning.set(false), half);
    }, half);
  }

  private scheduleTimer(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.pendingTimers.delete(id);
      fn();
    }, ms);
    this.pendingTimers.add(id);
  }

  /**
   * Leave-guard hook (`ReaderLeavable`). Fades the reader's visuals and
   * audio out before the route is torn down, so navigating to another
   * story/event — or back out of the reader — never cuts abruptly.
   * Always resolves true: the guard only delays, never blocks.
   */
  beginExit(): Promise<boolean> {
    if (this.exiting) return Promise.resolve(true);
    this.exiting = true;
    const audioMs = this.reducedMotion() ? REDUCED_MOTION_EXIT_MS : EXIT_FADE_MS;
    return Promise.all([
      this.fade.fadeOut(),
      this.bgmController?.fadeOutAndStop(audioMs) ?? Promise.resolve(),
      this.sfxController?.fadeOutAndStop(audioMs) ?? Promise.resolve(),
    ]).then(() => true);
  }

  protected readonly effectiveTextSpeed = computed(() =>
    resolveEffectiveTextSpeed(this.store.currentScene(), {
      allowTextAnimations: this.prefs.allowTextAnimations() && !this.reducedMotion(),
    }),
  );

  /**
   * Per-scene canonical character cache. Each scene fans out a single
   * `in` query at most (chunked at the Firestore cap of 30 per
   * `EntityResolverCache`) for the staged character IDs we need
   * `sprites[]` from. The directory projection only carries `label`, so
   * sprite arrays still require canonical reads — but scene-scoped, not
   * universe-wide per `docs/backend-rules.md` *Realtime listeners*.
   */
  private readonly sceneCharacters = signal<Map<string, Character>>(new Map());

  // Speaker chip — when the speaker is a character ref, resolve via the
  // session cache so name updates after a rename flow without a reload.
  private readonly speakerSignal = computed<Signal<ResolvedDirectoryRow | null> | null>(() => {
    const sp = this.store.currentScene()?.speaker;
    if (!sp || typeof sp === 'string') return null;
    return this.resolver.resolve({ kind: 'character', id: sp.id });
  });
  protected readonly speakerLabel = computed<string | undefined>(() => {
    const sp = this.store.currentScene()?.speaker;
    if (sp === undefined) return undefined;
    if (typeof sp === 'string') return sp;
    const sig = this.speakerSignal();
    return sig?.()?.label ?? sp.id;
  });

  // Background / audio go through the resolver's session cache so a
  // re-enter of the same scene during a session pays zero refetch cost.
  // Fallback chain: scene.backgroundAssetId → story.coverAssetId →
  // theme bg (the article's own surface color). Lets backgroundless
  // scenes inherit the story cover so the reader never shows an empty
  // surface unless the story has neither cover nor scene background.
  private readonly backgroundThumb = computed(() => {
    const scene = this.store.currentScene();
    const story = this.store.story();
    const id = scene?.backgroundAssetId ?? story?.coverAssetId;
    return this.assets.resolve(id)();
  });
  private readonly sfxThumb = computed(() =>
    this.assets.resolve(this.store.currentScene()?.sfxAssetId)(),
  );
  protected readonly backgroundUrl = computed(() => this.backgroundThumb()?.url);
  protected readonly backgroundBlurDataUrl = computed(() => this.backgroundThumb()?.blurDataUrl);
  private readonly sfxUrl = computed(() => this.sfxThumb()?.url ?? null);

  // BGM target = effective asset ID after applying scene override / silence flag
  // and story default. Resolved to a URL through the asset cache; the
  // BgmController owns the actual crossfade between the two audio slots.
  private readonly bgmTarget = computed(() =>
    resolveEffectiveBgm(this.store.currentScene(), this.store.story()),
  );
  private readonly bgmThumb = computed(() =>
    this.assets.resolve(this.bgmTarget().assetId ?? undefined)(),
  );
  private readonly bgmUrl = computed(() => this.bgmThumb()?.url ?? null);

  private readonly stagedRefs = computed<readonly EntityRef[]>(() => {
    const scene = this.store.currentScene();
    if (!scene) return [];
    return scene.characters.map<EntityRef>((sc) => ({ kind: 'character', id: sc.entity.id }));
  });
  private readonly resolvedStaged = this.resolver.resolveMany(this.stagedRefs);

  protected readonly stagedView = computed<StagedView[]>(() => {
    const scene = this.store.currentScene();
    if (!scene) return [];
    const sp = scene.speaker;
    const speakerId = sp && typeof sp !== 'string' ? sp.id : null;
    const resolved = this.resolvedStaged();
    const sprites = this.sceneCharacters();
    return scene.characters.map((sc) => {
      const directoryRow = resolved.get(`character:${sc.entity.id}`);
      const canonical = sprites.get(sc.entity.id);
      const characterSprites = canonical?.sprites ?? [];
      // Honor an authored `spriteId` immediately. Gating it behind the
      // canonical sprite list flashes the placeholder on every scene
      // entry while that doc loads; once canonical has loaded, an id no
      // longer in the character's library falls back to the default.
      let spriteId = sc.spriteId ?? characterSprites[0];
      if (sc.spriteId && canonical && !characterSprites.includes(sc.spriteId)) {
        spriteId = characterSprites[0];
      }
      return {
        id: sc.entity.id,
        name: directoryRow?.label ?? canonical?.name ?? sc.entity.id,
        position: sc.position,
        order: sc.order,
        spriteUrl: spriteId ? this.assets.resolve(spriteId)()?.url : undefined,
        isSpeaker: speakerId === sc.entity.id,
        facing: sc.facing ?? defaultFacing(sc.position),
      };
    });
  });

  // Inline-ref resolution per visible scene. parseRefs scans scene.text
  // (and could be extended to other fields); each unique ref hits the
  // session cache. The resolver batches misses into one `in` read of up
  // to 30 IDs per `docs/backend-rules.md` *Inline-ref resolution*.
  private readonly inlineRefs = computed<EntityRef[]>(() => {
    const text = this.store.currentScene()?.text ?? '';
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
    // Unresolved refs are intentionally omitted so the markdown renderer
    // emits `[displayText]` plain text rather than an anchor labelled
    // with the entity ID (see *Inline-ref tokens — Entity delete*).
    const out: InlineRefOption[] = [];
    for (const r of this.inlineRefs()) {
      const row = resolved.get(`${r.kind}:${r.id}`);
      if (!row) continue;
      out.push({ kind: r.kind, id: r.id, label: row.label, slug: row.slug });
    }
    return out;
  });

  // End-of-content continuation. Surfaces only on end-scenes
  // (`scene.next.length === 0`) and reads the first entry of
  // `nextRefs[]` — editors cap selection to one; the array shape is
  // preserved for future flexibility. Resolves the target's title
  // through the directory cache; unresolved or missing refs yield
  // null so the card simply omits the button.
  private readonly continuationRef = computed(() => {
    const scene = this.store.currentScene();
    if (!scene || scene.next.length > 0) return null;
    return scene.nextRefs?.[0] ?? null;
  });
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

  /**
   * Asset IDs reachable from the current scene's `next[]` choices. The
   * resolver-cache fetches their URLs (warming the cache for the next
   * navigate), then the preload effect hands those URLs to the browser
   * as `<link rel="prefetch">` so the binary lands during idle time.
   * Per `docs/media-rules.md` *Loading*.
   */
  private readonly nextSceneAssetIds = computed<readonly string[]>(() => {
    const content = this.store.content();
    const scene = this.store.currentScene();
    if (!content || !scene) return [];
    const ids = new Set<string>();
    for (const choice of scene.next) {
      const target = content.scenes[choice.sceneId];
      if (!target) continue;
      if (target.backgroundAssetId) ids.add(target.backgroundAssetId);
      if (target.sfxAssetId) ids.add(target.sfxAssetId);
      if (target.bgmAssetId) ids.add(target.bgmAssetId);
      // Staged characters with an explicit `spriteId` are cheap to warm
      // up — the canonical-character fallback (sprites[0]) requires a
      // separate canonical doc read so we skip those here and let them
      // load on demand the moment the scene mounts.
      for (const c of target.characters) {
        if (c.spriteId) ids.add(c.spriteId);
      }
    }
    return [...ids];
  });
  private readonly nextSceneAssets = this.assets.resolveMany(this.nextSceneAssetIds);

  constructor() {
    effect(() => {
      this.store.loadStory(this.id());
    });

    this.destroyRef.onDestroy(() => {
      for (const id of this.pendingTimers) clearTimeout(id);
      this.bgmController?.dispose();
      this.sfxController?.dispose();
    });

    // Scene-entry counter — increments every time `currentSceneId`
    // changes (forward via `choose()` *or* backward via `back()`). The
    // SfxController consumes this as a "scene visit key" so a back-nav
    // onto the same SFX URL still re-triggers playback from zero.
    effect(() => {
      this.store.currentSceneId();
      untracked(() => this.sceneEntryKey.update((n) => n + 1));
    });

    // Hydrate canonical character docs for the current scene's stage.
    // The directory row gives us the name, but not `sprites[]` — that
    // lives on the canonical doc.
    effect(() => {
      const ids = this.store
        .currentScene()
        ?.characters.map((c) => c.entity.id) ?? [];
      // Canonical docs accumulate for the whole reader session — never
      // evicted on a character-less scene — so navigating back onto a
      // staged scene resolves sprites with no refetch flash.
      const missing = ids.filter((id) => !this.sceneCharacters().has(id));
      if (missing.length === 0) return;
      void this.characters.getByIds(missing).then((fetched) => {
        if (fetched.size === 0) return;
        this.sceneCharacters.update((curr) => {
          const next = new Map(curr);
          for (const [id, char] of fetched) next.set(id, char);
          return next;
        });
      });
    });

    // Next-scene preloader. Hand the URLs reachable through
    // `Scene.next[]` to the browser via `<link rel="prefetch">` so a
    // tap on a choice navigates instantly. Per `docs/media-rules.md`
    // *Loading*: scheduled in `requestIdleCallback`, skipped on
    // save-data / 2g / slow-2g.
    effect(() => {
      if (!this.isBrowser) return;
      if (shouldSkipPreload()) return;
      const map = this.nextSceneAssets();
      if (map.size === 0) return;
      const urls: string[] = [];
      for (const thumb of map.values()) urls.push(thumb.url);
      schedulePrefetch(urls);
    });

    // Instantiate the BGM controller the moment its two `<audio>` slots
    // mount. They live inside the `@else if (store.story(); …)` branch
    // so they don't exist on first render — `ngAfterViewInit` fires too
    // early. Watching the viewChild signals lets us hook in as soon as
    // the elements arrive, regardless of when the story loads.
    effect(() => {
      const a = this.bgmA()?.nativeElement;
      const b = this.bgmB()?.nativeElement;
      if (!a || !b) return;
      if (this.bgmController) return;
      const controller = new BgmController(a, b);
      this.bgmController = controller;
      // Apply the current state untracked so this creator effect doesn't
      // also become reactive to bgmTarget/bgmUrl/bgmVolume — those are
      // owned by the dedicated effects below.
      untracked(() => {
        controller.setUserVolume(this.prefs.bgmVolume());
        controller.setTarget(this.bgmTarget(), this.bgmUrl());
      });
    });

    // Drive the BGM controller on scene/volume changes. Decoupled from
    // playback by design — the controller does its own crossfade so
    // consecutive same-URL scenes leave the active audio element playing
    // untouched.
    effect(() => {
      const target = this.bgmTarget();
      const url = this.bgmUrl();
      this.bgmController?.setTarget(target, url);
    });
    effect(() => {
      // Read the signal into a local first — `a?.b(c)` short-circuits
      // argument evaluation when `a` is null, which on first run (before
      // the controller exists) would leave this effect with zero tracked
      // dependencies and it would never re-fire when the slider moves.
      const v = this.prefs.bgmVolume();
      this.bgmController?.setUserVolume(v);
    });

    // SfxController follows the same shape as BgmController above.
    effect(() => {
      const a = this.sfxA()?.nativeElement;
      const b = this.sfxB()?.nativeElement;
      if (!a || !b) return;
      if (this.sfxController) return;
      const controller = new SfxController(a, b);
      this.sfxController = controller;
      untracked(() => {
        controller.setUserVolume(this.prefs.sfxVolume());
        controller.setTarget(this.sfxUrl(), this.sceneEntryKey());
      });
    });
    effect(() => {
      const url = this.sfxUrl();
      const key = this.sceneEntryKey();
      this.sfxController?.setTarget(url, key);
    });
    effect(() => {
      const v = this.prefs.sfxVolume();
      this.sfxController?.setUserVolume(v);
    });

    // Autoplay unblock — keep every gesture wired to the controllers so
    // playback can recover if one was built outside a gesture frame and
    // the browser blocked its initial play().
    registerAutoplayUnblock(() => {
      this.bgmController?.unblock();
      this.sfxController?.unblock();
    });
  }
}

// ---------------------------------------------------------------------
// Default sprite-facing derived from the staged slot. Authors override
// with `StagedCharacter.facing` for cross-stage looks (e.g., a left-slot
// character glancing offscreen left).
// ---------------------------------------------------------------------

function defaultFacing(position: string): 'left' | 'right' {
  return position === 'right' ? 'left' : 'right';
}

// Scene-transition duration, defaulting to 500 ms and bounded to a sane
// range so a malformed `transitionMs` can't stall the reader.
function clampTransitionMs(ms: number | undefined): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return 500;
  return Math.min(Math.max(ms, 100), 3000);
}

// ---------------------------------------------------------------------
// Idle prefetch helpers. Keeping these as module-level functions so
// `prefetched` is process-wide — a single asset prefetched on one scene
// stays prefetched for any other scene that reaches it.
// ---------------------------------------------------------------------

const prefetched = new Set<string>();

function schedulePrefetch(urls: readonly string[]): void {
  const pending = urls.filter((u) => u && !prefetched.has(u));
  if (pending.length === 0) return;
  const run = () => {
    for (const u of pending) prefetch(u);
  };
  // `requestIdleCallback` is browser-only and not on every platform; the
  // setTimeout fallback keeps the prefetch off the critical path on
  // browsers that lack it (Safari ≤ 17.x).
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 0);
  }
}

function prefetch(url: string): void {
  if (prefetched.has(url)) return;
  prefetched.add(url);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  // Best-effort kind hint — actual subresource type is determined by
  // the response. `as='image'` for likely-image URLs, `as='fetch'`
  // otherwise so the browser still treats it as low-priority.
  link.as = isLikelyImageUrl(url) ? 'image' : 'fetch';
  link.href = url;
  document.head.appendChild(link);
}

function isLikelyImageUrl(url: string): boolean {
  return /\.(webp|jpe?g|png|avif|gif)(\?|$)/i.test(url);
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Honors the user's data-saver / slow-network hints per
 * `docs/media-rules.md` *Loading*. `navigator.connection` is non-standard
 * (Chromium-only) — when it's absent we don't preload either, treating
 * "unknown" the same as "explicit slow" so the player never thrashes a
 * data-constrained device.
 */
function shouldSkipPreload(): boolean {
  if (typeof navigator === 'undefined') return true;
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  const eff = conn.effectiveType;
  return eff === 'slow-2g' || eff === '2g';
}
