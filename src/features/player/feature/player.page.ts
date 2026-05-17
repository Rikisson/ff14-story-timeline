import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
  Signal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { Character, CharactersService } from '@features/characters';
import {
  AssetThumbResolver,
  EntityResolverCache,
  ResolvedDirectoryRow,
} from '@shared/data-access';
import { EntityRef } from '@shared/models';
import {
  GhostButtonComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { InlineRefOption, parseRefs } from '@shared/utils';
import { PlayerStore } from '../data-access/player.store';
import { ChoiceListComponent } from '../ui/choice-list.component';
import { SceneViewComponent, StagedView } from '../ui/scene-view.component';
import playerEn from '../i18n/en.json';
import playerUk from '../i18n/uk.json';

@Component({
  selector: 'app-player-page',
  imports: [
    RouterLink,
    SceneViewComponent,
    ChoiceListComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
    TranslocoDirective,
  ],
  providers: [
    PlayerStore,
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
      <div class="mx-auto flex max-w-3xl flex-col gap-4">
        @if (store.loading()) {
          <p class="text-foreground-subtle">{{ t('message.loading') }}</p>
        } @else if (store.error(); as err) {
          <p class="text-danger-foreground">{{ err }}</p>
          <p><a routerLink="/library" class="text-accent hover:underline">{{ t('action.backToCatalog') }}</a></p>
        } @else if (store.story(); as story) {
          <header class="flex flex-wrap items-center gap-3">
            <h1 class="m-0 text-2xl font-semibold text-foreground">{{ story.title }}</h1>
            <div class="ml-auto flex items-center gap-2">
              <button
                uiGhost
                type="button"
                [disabled]="!store.canGoBack()"
                (click)="store.back()"
              >
                {{ t('action.back') }}
              </button>
              <a routerLink="/library" class="text-sm text-foreground-subtle hover:underline">{{ t('action.catalog') }}</a>
            </div>
          </header>

          @if (store.pendingResume(); as resume) {
            <aside
              class="flex flex-wrap items-center gap-3 rounded-md border border-accent-ring bg-accent-soft px-4 py-3"
              role="status"
            >
              <p class="m-0 text-sm text-accent-soft-foreground">
                {{ t('message.savedSpot') }}
              </p>
              <div class="ml-auto flex gap-2">
                <button uiPrimary type="button" (click)="store.resume()">{{ t('action.resume') }}</button>
                <button uiSecondary type="button" (click)="store.dismissResume()">
                  {{ t('action.startOver') }}
                </button>
              </div>
            </aside>
          }

          @if (store.currentScene(); as scene) {
            <app-scene-view
              [text]="scene.text"
              [speaker]="speakerLabel()"
              [background]="backgroundUrl()"
              [audio]="audioUrl()"
              [staged]="stagedView()"
              [inlineRefOptions]="inlineRefOptions()"
            />

            @if (scene.next.length === 0) {
              <div class="flex flex-wrap items-center gap-3">
                <p class="m-0 italic text-foreground-subtle">{{ t('message.end') }}</p>
                <button uiPrimary type="button" (click)="store.restart()">{{ t('action.restart') }}</button>
                <a routerLink="/library" class="text-sm text-accent hover:underline">
                  {{ t('action.backToCatalog') }}
                </a>
              </div>
            } @else {
              <app-choice-list [choices]="scene.next" (choose)="store.choose($event)" />
            }
          }
        }
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerPage {
  readonly id = input.required<string>();
  protected readonly store = inject(PlayerStore);
  private readonly characters = inject(CharactersService);
  private readonly assets = inject(AssetThumbResolver);
  private readonly resolver = inject(EntityResolverCache);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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
  private readonly backgroundThumb = computed(() =>
    this.assets.resolve(this.store.currentScene()?.backgroundAssetId)(),
  );
  private readonly audioThumb = computed(() =>
    this.assets.resolve(this.store.currentScene()?.audioAssetId)(),
  );
  protected readonly backgroundUrl = computed(() => this.backgroundThumb()?.url);
  protected readonly audioUrl = computed(() => this.audioThumb()?.url);

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
      if (target.audioAssetId) ids.add(target.audioAssetId);
    }
    return [...ids];
  });
  private readonly nextSceneAssets = this.assets.resolveMany(this.nextSceneAssetIds);

  constructor() {
    effect(() => {
      this.store.loadStory(this.id());
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
  }
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
