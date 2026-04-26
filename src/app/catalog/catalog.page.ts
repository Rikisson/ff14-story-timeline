import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StoriesService } from '../stories/stories.service';

@Component({
  selector: 'app-catalog-page',
  imports: [RouterLink],
  template: `
    <h2>Catalog</h2>
    @if (stories().length === 0) {
      <p>No stories published yet.</p>
    } @else {
      <ul>
        @for (story of stories(); track story.id) {
          <li>
            <a [routerLink]="['/play', story.id]">{{ story.title }}</a>
            @if (story.summary) {
              — {{ story.summary }}
            }
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {
  protected readonly stories = inject(StoriesService).publishedStories;
}
