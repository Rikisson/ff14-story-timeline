import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { MediaAssetsService } from '@features/media';
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
    NgOptimizedImage,
    GhostButtonComponent,
    DangerButtonComponent,
    EntityRefComponent,
    MarkdownTextComponent,
    TranslocoDirective,
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <article
        class="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
      >
        @if (coverUrl(); as u) {
          <div class="relative aspect-video w-full bg-surface-muted">
            <img [ngSrc]="u" alt="" fill class="object-cover" />
          </div>
        }
        <div class="flex flex-1 flex-col gap-3 p-4">
          <div class="flex items-start justify-between gap-2">
            <h3 class="m-0 flex-1 text-lg font-semibold text-foreground">{{ place().name }}</h3>
            @if (canEdit()) {
              <div class="flex shrink-0 gap-1">
                <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
                <button uiDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
              </div>
            }
          </div>
          @if (place().description; as d) {
            <app-markdown-text
              class="text-sm text-foreground-muted"
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
        </div>
      </article>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceCardComponent {
  readonly place = input.required<Place>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly entityResolver = inject(EntityResolverService);
  private readonly media = inject(MediaAssetsService);

  protected readonly relatedRefs = computed(() => this.place().relatedRefs ?? []);
  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;
  protected readonly coverUrl = computed(() => this.media.urlFor(this.place().coverAssetId));
}
