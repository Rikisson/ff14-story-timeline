import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { CharactersService } from '@features/characters';
import { MediaAssetsService } from '@features/media';
import { EntityResolverService } from '@shared/data-access';
import {
  GhostButtonComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
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
  private readonly media = inject(MediaAssetsService);
  private readonly entityResolver = inject(EntityResolverService);

  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly backgroundUrl = computed(() =>
    this.media.urlFor(this.store.currentScene()?.backgroundAssetId),
  );
  protected readonly audioUrl = computed(() =>
    this.media.urlFor(this.store.currentScene()?.audioAssetId),
  );

  protected readonly speakerLabel = computed<string | undefined>(() => {
    const sp = this.store.currentScene()?.speaker;
    if (sp === undefined) return undefined;
    if (typeof sp === 'string') return sp;
    return this.characters.characters().find((c) => c.id === sp.id)?.name ?? sp.id;
  });

  protected readonly stagedView = computed<StagedView[]>(() => {
    const scene = this.store.currentScene();
    if (!scene) return [];
    const sp = scene.speaker;
    const speakerId = sp && typeof sp !== 'string' ? sp.id : null;
    const charList = this.characters.characters();
    return scene.characters.map((sc) => {
      const char = charList.find((c) => c.id === sc.entity.id);
      const sprites = char?.sprites ?? [];
      const spriteId = sc.spriteId && sprites.includes(sc.spriteId) ? sc.spriteId : sprites[0];
      return {
        id: sc.entity.id,
        name: char?.name ?? sc.entity.id,
        position: sc.position,
        order: sc.order,
        spriteUrl: this.media.urlFor(spriteId),
        isSpeaker: speakerId === sc.entity.id,
      };
    });
  });

  constructor() {
    effect(() => {
      this.store.loadStory(this.id());
    });
  }
}
