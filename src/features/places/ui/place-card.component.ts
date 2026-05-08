import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Place } from '../data-access/place.types';
import { EntityResolverService } from '@shared/data-access';
import {
  DangerButtonComponent,
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
} from '@shared/ui';

@Component({
  selector: 'app-place-card',
  imports: [
    GhostButtonComponent,
    DangerButtonComponent,
    EntityRefComponent,
    MarkdownTextComponent,
  ],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="m-0 flex-1 text-lg font-semibold text-slate-900">{{ place().name }}</h3>
        @if (canEdit()) {
          <div class="flex shrink-0 gap-1">
            <button uiGhost type="button" (click)="edit.emit()">Edit</button>
            <button uiDanger type="button" (click)="remove.emit()">Delete</button>
          </div>
        }
      </div>
      @if (place().description; as d) {
        <app-markdown-text
          class="text-sm text-slate-700"
          [text]="d"
          [options]="inlineRefOptions()"
        />
      }
      @if (relatedRefs().length > 0) {
        <div class="flex flex-wrap gap-1.5">
          @for (r of relatedRefs(); track r.kind + ':' + r.id) {
            <app-entity-ref [ref]="r" />
          }
        </div>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceCardComponent {
  readonly place = input.required<Place>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly entityResolver = inject(EntityResolverService);

  protected readonly relatedRefs = computed(() => this.place().relatedRefs ?? []);
  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;
}
