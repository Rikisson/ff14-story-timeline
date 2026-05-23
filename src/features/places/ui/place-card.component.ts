import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ContentLangDirective } from '@features/universes';
import { Place } from '../data-access/place.types';
import {
  GhostDangerButtonComponent,
  DetailCardComponent,
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
} from '@shared/ui';

@Component({
  selector: 'app-place-card',
  imports: [
    DetailCardComponent,
    EntityRefComponent,
    MarkdownTextComponent,
    GhostButtonComponent,
    GhostDangerButtonComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <app-detail-card [coverAssetId]="place().coverAssetId">
        <div class="flex items-start justify-between gap-3">
          <h2 appContentLang class="m-0 min-w-0 flex-1 font-display text-2xl font-semibold text-foreground">{{ place().name }}</h2>
          @if (canEdit()) {
            <div class="flex shrink-0 items-center gap-2">
              <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
              <button uiGhostDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
            </div>
          }
        </div>

        <div appContentLang class="contents">
          @if (place().description; as d) {
            <app-markdown-text class="text-sm text-foreground-muted" [text]="d" />
          }

          @if (relatedRefs().length > 0) {
            <ul class="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
              @for (r of relatedRefs(); track r.kind + ':' + r.id) {
                <li><app-entity-ref [ref]="r" /></li>
              }
            </ul>
          }
        </div>
      </app-detail-card>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceCardComponent {
  readonly place = input.required<Place>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly relatedRefs = computed(() => this.place().relatedRefs ?? []);
}
