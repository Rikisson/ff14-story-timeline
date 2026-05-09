import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-player-page',
  imports: [
    RouterLink,
    SceneViewComponent,
    ChoiceListComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
  ],
  providers: [PlayerStore],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-4">
      @if (store.loading()) {
        <p class="text-slate-600 dark:text-slate-400">Loading...</p>
      } @else if (store.error(); as err) {
        <p class="text-red-700 dark:text-red-400">{{ err }}</p>
        <p><a routerLink="/library" class="text-indigo-700 dark:text-indigo-300 hover:underline">Back to catalog</a></p>
      } @else if (store.story(); as story) {
        <header class="flex flex-wrap items-center gap-3">
          <h1 class="m-0 text-2xl font-semibold text-slate-900 dark:text-slate-100">{{ story.title }}</h1>
          <div class="ml-auto flex items-center gap-2">
            <button
              uiGhost
              type="button"
              [disabled]="!store.canGoBack()"
              (click)="store.back()"
            >
              ← Back
            </button>
            <a routerLink="/library" class="text-sm text-slate-600 dark:text-slate-400 hover:underline">Catalog</a>
          </div>
        </header>

        @if (store.pendingResume(); as resume) {
          <aside
            class="flex flex-wrap items-center gap-3 rounded-md border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-4 py-3"
            role="status"
          >
            <p class="m-0 text-sm text-indigo-900 dark:text-indigo-200">
              You have a saved spot in this story.
            </p>
            <div class="ml-auto flex gap-2">
              <button uiPrimary type="button" (click)="store.resume()">Resume</button>
              <button uiSecondary type="button" (click)="store.dismissResume()">
                Start over
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
              <p class="m-0 italic text-slate-600 dark:text-slate-400">The end.</p>
              <button uiPrimary type="button" (click)="store.restart()">Restart</button>
              <a routerLink="/library" class="text-sm text-indigo-700 dark:text-indigo-300 hover:underline">
                Back to catalog
              </a>
            </div>
          } @else {
            <app-choice-list [choices]="scene.next" (choose)="store.choose($event)" />
          }
        }
      }
    </div>
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
