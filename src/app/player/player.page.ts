import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerStore } from './player.store';

@Component({
  selector: 'app-player-page',
  imports: [RouterLink],
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

      <article class="scene">
        @if (scene.speaker) {
          <p class="speaker">{{ scene.speaker }}</p>
        }
        <p class="text">{{ scene.text }}</p>
      </article>

      <div class="choices">
        @if (scene.next.length === 0) {
          <p><em>The end.</em></p>
          <button type="button" (click)="store.restart()">Restart</button>
          <a routerLink="/">Back to catalog</a>
        } @else {
          @for (choice of scene.next; track $index) {
            <button type="button" (click)="store.choose(choice.sceneId)">
              {{ choice.label ?? 'Continue' }}
            </button>
          }
        }
      </div>
    }
  `,
  styles: `
    .scene {
      max-width: 640px;
      margin: 0 0 1.5rem;
      padding: 1rem 1.25rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background: #fff;
    }
    .speaker {
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: #374151;
    }
    .text {
      margin: 0;
      line-height: 1.6;
    }
    .choices {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 640px;
      align-items: flex-start;
    }
    .choices button {
      padding: 0.5rem 1rem;
      text-align: left;
      cursor: pointer;
    }
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
