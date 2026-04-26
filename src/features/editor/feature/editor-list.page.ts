import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { authFeature } from '@features/auth';
import { StoriesService, Story } from '@features/stories';

@Component({
  selector: 'app-editor-list-page',
  imports: [RouterLink],
  template: `
    <h2>My stories</h2>
    <p>List of stories you authored, plus a "new story" button.</p>

    <p>
      <button type="button" (click)="createExample()" [disabled]="creating()">
        {{ creating() ? 'Creating...' : 'Create example story' }}
      </button>
    </p>

    @if (lastCreatedId(); as id) {
      <p>
        Created
        <a [routerLink]="['/edit', id]">{{ id }}</a>
        — visible on the
        <a routerLink="/">catalog</a>.
      </p>
    }

    @if (error(); as err) {
      <p style="color: #b00020">{{ err }}</p>
    }

    <p>
      <a [routerLink]="['/edit', 'demo']">Open demo editor</a>
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorListPage {
  private readonly stories = inject(StoriesService);
  private readonly user = inject(Store).selectSignal(authFeature.selectUser);

  protected readonly creating = signal(false);
  protected readonly lastCreatedId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  async createExample(): Promise<void> {
    const user = this.user();
    if (!user) {
      this.error.set('Sign in first.');
      return;
    }

    this.creating.set(true);
    this.error.set(null);

    const id = crypto.randomUUID();
    const story: Story = {
      id,
      title: 'Example: A Walk in Limsa',
      summary: 'Demo story to verify Firestore wiring.',
      mainCharacters: ['Warrior of Light', "Y'shtola"],
      places: ['Limsa Lominsa'],
      inGameDate: '1.578',
      startSceneId: 'scene-1',
      scenes: {
        'scene-1': {
          text: 'You arrive at the Aetheryte Plaza.',
          position: { x: 0, y: 0 },
          next: [{ sceneId: 'scene-2' }],
        },
        'scene-2': {
          text: "Y'shtola greets you with a knowing smile.",
          speaker: "Y'shtola",
          position: { x: 320, y: 0 },
          next: [{ sceneId: 'scene-3' }],
        },
        'scene-3': {
          text: 'The end.',
          position: { x: 640, y: 0 },
          next: [],
        },
      },
      authorUid: user.uid,
      draft: false,
      publishedAt: Date.now(),
    };

    try {
      await this.stories.saveStory(story);
      this.lastCreatedId.set(id);
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      this.error.set(message);
    } finally {
      this.creating.set(false);
    }
  }
}
