import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Story } from '@features/stories';
import { CatalogCardComponent } from './catalog-card.component';

@Component({
  selector: 'app-catalog-list',
  imports: [CatalogCardComponent],
  template: `
    <ul
      class="grid w-full grid-cols-[repeat(auto-fill,minmax(280px,1fr))] justify-start gap-4"
    >
      @for (story of stories(); track story.id) {
        <li>
          <app-catalog-card
            [story]="story"
            [canEdit]="canManage()"
            (remove)="remove.emit($event)"
          />
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent {
  readonly stories = input.required<Story[]>();
  readonly canManage = input<boolean>(false);

  readonly remove = output<string>();
}
