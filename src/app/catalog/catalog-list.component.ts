import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
          <app-catalog-card [story]="story" [canEdit]="canEdit(story)" />
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogListComponent {
  readonly stories = input.required<Story[]>();
  readonly currentUserUid = input<string | null>(null);

  protected canEdit(story: Story): boolean {
    const uid = this.currentUserUid();
    return !!uid && uid === story.authorUid;
  }
}
