import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerStore } from '../data-access/player.store';
import { ChoiceListComponent } from '../ui/choice-list.component';
import { SceneViewComponent } from '../ui/scene-view.component';

@Component({
  selector: 'app-player-page',
  imports: [RouterLink, SceneViewComponent, ChoiceListComponent],
  providers: [PlayerStore],
  template: `
    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as err) {
      <p class="error">{{ err }}</p>
      <p><a routerLink="/">Back to catalog</a></p>
    } @else if (store.currentScene(); as scene) {
      @if (store.story(); as story) {
        <h2>{{ story.title }}</h2>
      }

      <app-scene-view [text]="scene.text" [speaker]="scene.speaker" />

      @if (scene.next.length === 0) {
        <p><em>The end.</em></p>
        <button type="button" (click)="store.restart()">Restart</button>
        <a routerLink="/">Back to catalog</a>
      } @else {
        <app-choice-list [choices]="scene.next" (select)="store.choose($event)" />
      }
    }
  `,
  styles: `
    .error {
      color: #b00020;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerPage {
  readonly id = input.required<string>();
  protected readonly store = inject(PlayerStore);

  constructor() {
    effect(() => {
      this.store.loadStory(this.id());
    });
  }
}
