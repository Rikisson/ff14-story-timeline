import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CharactersService } from '@features/characters';
import { GhostButtonComponent, PrimaryButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { PlayerStore } from '../data-access/player.store';
import { ChoiceListComponent } from '../ui/choice-list.component';
import { SceneViewComponent } from '../ui/scene-view.component';

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
        <p class="text-slate-600">Loading...</p>
      } @else if (store.error(); as err) {
        <p class="text-red-700">{{ err }}</p>
        <p><a routerLink="/" class="text-indigo-700 hover:underline">Back to catalog</a></p>
      } @else if (store.story(); as story) {
        <header class="flex flex-wrap items-center gap-3">
          <h1 class="m-0 text-2xl font-semibold text-slate-900">{{ story.title }}</h1>
          <div class="ml-auto flex items-center gap-2">
            <button
              uiGhost
              type="button"
              [disabled]="!store.canGoBack()"
              (click)="store.back()"
            >
              ← Back
            </button>
            <a routerLink="/" class="text-sm text-slate-600 hover:underline">Catalog</a>
          </div>
        </header>

        @if (store.pendingResume(); as resume) {
          <aside
            class="flex flex-wrap items-center gap-3 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3"
            role="status"
          >
            <p class="m-0 text-sm text-indigo-900">
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
            [background]="scene.background"
            [audio]="scene.audio"
          />

          @if (scene.next.length === 0) {
            <div class="flex flex-wrap items-center gap-3">
              <p class="m-0 italic text-slate-600">The end.</p>
              <button uiPrimary type="button" (click)="store.restart()">Restart</button>
              <a routerLink="/" class="text-sm text-indigo-700 hover:underline">
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

  protected readonly speakerLabel = computed<string | undefined>(() => {
    const sp = this.store.currentScene()?.speaker;
    if (sp === undefined) return undefined;
    if (typeof sp === 'string') return sp;
    return this.characters.characters().find((c) => c.id === sp.id)?.name ?? sp.id;
  });

  constructor() {
    effect(() => {
      this.store.loadStory(this.id());
    });
  }
}
