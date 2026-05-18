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
import { EndOfContentComponent } from '../ui/end-of-content.component';
import { ReaderPreferencesDialogComponent } from '../ui/reader-preferences-dialog.component';
import { SceneViewComponent, StagedView } from '../ui/scene-view.component';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';
import { BgmController } from './bgm-controller';
import { SfxController } from './sfx-controller';

@Component({
  selector: 'app-reader-story-page',
  host: { class: 'block h-full' },
  imports: [
    RouterLink,
    SceneViewComponent,
    EndOfContentComponent,
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
      <div [class]="rootClass()">
        @if (store.loading()) {
          @if (showLoadingIndicator()) {
            <p class="mx-auto w-full max-w-7xl px-4 pt-4 text-foreground-subtle">{{ t('message.loading') }}</p>
          }
        } @else if (store.error(); as err) {
          <div class="mx-auto w-full max-w-7xl px-4 pt-4">
            <p class="text-danger-foreground">{{ err }}</p>
            <p><a routerLink="/library" class="text-accent hover:underline">{{ t('action.backToCatalog') }}</a></p>
          </div>
        } @else if (store.story(); as story) {
          @if (store.currentScene(); as scene) {
            <app-scene-view
              class="absolute inset-0"
              [text]="scene.text"
              [layout]="scene.layout ?? 'dialog'"
              [speaker]="speakerLabel()"
              [background]="backgroundUrl()"
              [backgroundBlurDataUrl]="backgroundBlurDataUrl()"
              [backgroundEffect]="scene.backgroundEffect"
              [staged]="stagedView()"
              [choices]="scene.next"
              [inlineRefOptions]="inlineRefOptions()"
              [textSpeed]="effectiveTextSpeed()"
              (choose)="store.choose($event)"
            />
          }

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
                    (click)="store.back()"
                  >
                    {{ t('action.back') }}
                  </button>
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

          @if (store.currentScene(); as scene) {
            @if (scene.next.length === 0 && (scene.nextRefs?.length ?? 0) > 0) {
              <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10">
                <app-end-of-content
                  class="pointer-events-auto block"
                  [nextRefs]="scene.nextRefs"
                />
              </div>
            }
          }

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
      </div>

      <app-reader-preferences-dialog #prefsDialog />
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderStoryPage {
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

  // 500 ms deferral so a fast load (cache hit) renders straight to the
  // scene without a loading flash. Per the player spec the indicator is
  // a delay-gated affordance, not a guarantee.
  protected readonly showLoadingIndicator = signal(false);

  // Idle-fade chrome: the title bar + resume aside fade after this
  // many ms of no `pointermove` / `pointerdown` / `keydown`. Any of
  // those events re-shows it instantly. Kept on the page (not the
  // shared `LayoutStore`) because the trigger is reader-specific.
  private static readonly CHROME_IDLE_MS = 2500;
  protected readonly chromeIdle = signal(false);

  // OS-level reduced-motion preference. When set, the typewriter goes
  // instant regardless of the reader's own `allowTextAnimations`
  // setting. Lives separately from the user preference so toggling
  // animations on doesn't also defy the OS-level accessibility hint.
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
      const spriteId =
        sc.spriteId && characterSprites.includes(sc.spriteId)
          ? sc.spriteId
          : characterSprites[0];
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

    // OS-level reduced-motion: read once and react to live changes so
    // a user enabling reduced motion mid-session collapses the
    // typewriter to instant on the next scene without a reload.
    if (this.isBrowser) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion.set(mq.matches);
      const onChange = (e: MediaQueryListEvent): void => this.reducedMotion.set(e.matches);
      mq.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    }

    // Chrome reveal: the floating header card shows on page load, then
    // hides after `CHROME_IDLE_MS`. After that, it only re-appears while
    // the pointer sits in the top hover zone, which spans the header's
    // own top padding, the card itself, and an equal pad below — so the
    // user can keep the pointer anywhere over the card without triggering
    // the hide timer. Falls back to `FALLBACK_HOVER_PX` until the header
    // element mounts.
    if (this.isBrowser) {
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      const FALLBACK_HOVER_PX = 82;
      const startHideTimer = (): void => {
        if (idleTimer !== null) clearTimeout(idleTimer);
        idleTimer = setTimeout(
          () => this.chromeIdle.set(true),
          ReaderStoryPage.CHROME_IDLE_MS,
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

    // Defer the loading indicator by 500 ms — fast resolves go straight
    // to the scene with no flicker.
    let pendingIndicator: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const loading = this.store.loading();
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
      this.sfxController?.dispose();
      // Leaving the player while in fullscreen would otherwise strand
      // the browser in its native-fullscreen state with no UI to exit.
      void this.layout.exitFullscreen();
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
      if (ids.length === 0) {
        if (this.sceneCharacters().size > 0) this.sceneCharacters.set(new Map());
        return;
      }
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

    // First-user-gesture autoplay unblock. Browsers reject `play()` on
    // a fresh tab until the user has interacted with it; if that
    // happens, the controllers' `wantsPlay` flags stay set. Retrying
    // inside a real gesture handler succeeds. Capture-phase + once on
    // both pointer and key so even keyboard-only navigation kicks audio
    // awake.
    if (this.isBrowser) {
      const onFirstGesture = (): void => {
        this.bgmController?.unblock();
        this.sfxController?.unblock();
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

// ---------------------------------------------------------------------
// Default sprite-facing derived from the staged slot. Authors override
// with `StagedCharacter.facing` for cross-stage looks (e.g., a left-slot
// character glancing offscreen left).
// ---------------------------------------------------------------------

function defaultFacing(position: string): 'left' | 'right' {
  return position === 'right' ? 'left' : 'right';
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
