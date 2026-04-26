import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Story } from '@features/stories';

@Component({
  selector: 'app-catalog-list',
  imports: [RouterLink],
  template: `
    <ul class="flex flex-col divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
      @for (story of stories(); track story.id) {
        <li class="flex flex-col gap-1 px-4 py-3">
          <a
            [routerLink]="['/play', story.id]"
            class="text-base font-semibold text-indigo-700 hover:underline"
          >
            {{ story.title }}
          </a>
          @if (story.summary) {
            <p class="text-sm text-slate-600">{{ story.summary }}</p>
          }
          <div class="flex flex-wrap gap-2 text-xs text-slate-500">
            @if (story.inGameDate) {
              <span class="rounded bg-slate-100 px-2 py-0.5">{{ story.inGameDate }}</span>
            }
            @for (c of story.mainCharacters; track c) {
              <span class="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700">{{ c }}</span>
            }
            @for (p of story.places; track p) {
              <span class="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">{{ p }}</span>
            }
          </div>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent {
  readonly stories = input.required<Story[]>();
}
