import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { authFeature } from '@features/auth';
import { PrimaryButtonComponent } from '@shared/ui';
import { StoriesService, Story } from '@features/stories';

@Component({
  selector: 'app-editor-list-page',
  imports: [RouterLink, PrimaryButtonComponent],
  template: `
    <header class="bar">
      <h2>My stories</h2>
      <button uiPrimary type="button" (click)="createStory()" [loading]="creating()">
        + New story
      </button>
    </header>

    @if (error(); as err) {
      <p class="error">{{ err }}</p>
    }

    @if (myStories().length === 0) {
      <p class="empty">You haven't created any stories yet.</p>
    } @else {
      <ul>
        @for (story of myStories(); track story.id) {
          <li>
            <a [routerLink]="['/edit', story.id]">{{ story.title || 'Untitled' }}</a>
            @if (story.draft) {
              <span class="badge draft">DRAFT</span>
            } @else {
              <span class="badge published">PUBLISHED</span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .bar h2 {
      flex: 1;
      margin: 0;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
    }
    .badge.draft {
      background: #fef3c7;
      color: #92400e;
    }
    .badge.published {
      background: #dcfce7;
      color: #166534;
    }
    .empty {
      color: #6b7280;
      font-style: italic;
    }
    .error {
      color: #b00020;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorListPage {
  private readonly stories = inject(StoriesService);
  private readonly router = inject(Router);
  private readonly user = inject(Store).selectSignal(authFeature.selectUser);

  protected readonly myStories = signal<Story[]>([]);
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const user = this.user();
      if (!user) {
        this.myStories.set([]);
        return;
      }
      const unsubscribe = this.stories.subscribeAuthorStories(user.uid, (list) => {
        this.myStories.set(list);
      });
      onCleanup(() => unsubscribe());
    });
  }

  async createStory(): Promise<void> {
    const user = this.user();
    if (!user) {
      this.error.set('Sign in first.');
      return;
    }

    this.creating.set(true);
    this.error.set(null);

    const id = crypto.randomUUID();
    const startSceneId = crypto.randomUUID();
    const story: Story = {
      id,
      title: 'Untitled story',
      mainCharacters: [],
      places: [],
      inGameDate: '',
      startSceneId,
      scenes: {
        [startSceneId]: {
          text: '',
          position: { x: 0, y: 0 },
          next: [],
        },
      },
      authorUid: user.uid,
      draft: true,
    };

    try {
      await this.stories.saveStory(story);
      await this.router.navigate(['/edit', id]);
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      this.error.set(message);
    } finally {
      this.creating.set(false);
    }
  }
}
