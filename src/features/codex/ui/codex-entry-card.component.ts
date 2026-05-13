import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { MediaAssetsService } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { EntityRefComponent, UTILITY_DANGER, UTILITY_SECONDARY } from '@shared/ui';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import { CodexEntry } from '../data-access/codex-entry.types';

@Component({
  selector: 'app-codex-entry-card',
  imports: [
    NgOptimizedImage,
    EntityRefComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <article
        class="relative h-full w-full overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
      >
        @if (coverUrl(); as u) {
          <img
            [ngSrc]="u"
            alt=""
            fill
            class="absolute inset-0 object-cover"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/40 to-scrim/20"
            aria-hidden="true"
          ></div>
        }

        @if (canEdit()) {
          <div class="absolute right-3 top-3 z-20 flex items-center gap-2">
            <button type="button" [class]="utilSecondaryClass" (click)="edit.emit()">{{ g('action.edit') }}</button>
            <button type="button" [class]="utilDangerClass" (click)="remove.emit()">{{ g('action.delete') }}</button>
          </div>
        }

        <div
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-12 text-center"
        >
          <div appContentLang class="contents">
            <div class="flex flex-wrap items-center justify-center gap-3">
              <h2
                class="m-0 text-2xl font-bold sm:text-3xl"
                [class.text-scrim-foreground]="hasImage()"
                [class.drop-shadow-md]="hasImage()"
                [class.text-foreground]="!hasImage()"
              >{{ entry().title }}</h2>
              @if (entry().category; as c) {
                <span
                  class="inline-flex items-center rounded-full border bg-surface/90 px-2 py-0.5 text-xs font-medium shadow-sm"
                  [style.borderColor]="categoryColor() ?? 'var(--color-border-strong)'"
                  [style.color]="categoryColor() ?? 'var(--color-foreground-subtle)'"
                >{{ c }}</span>
              }
            </div>

            <p
              class="m-0 max-w-2xl whitespace-pre-line text-sm line-clamp-6"
              [class.text-scrim-foreground]="hasImage()"
              [class.drop-shadow]="hasImage()"
              [class.text-foreground-muted]="!hasImage()"
            >{{ entry().description }}</p>

            @if ((entry().relatedRefs ?? []).length > 0) {
              <ul class="m-0 flex list-none flex-wrap items-center justify-center gap-1.5 p-0">
                @for (r of entry().relatedRefs ?? []; track r.kind + ':' + r.id) {
                  <li><app-entity-ref [ref]="r" /></li>
                }
              </ul>
            }
          </div>

        </div>
      </article>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexEntryCardComponent {
  readonly entry = input.required<CodexEntry>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly categories = inject(CodexCategoriesService);
  private readonly media = inject(MediaAssetsService);

  protected readonly utilSecondaryClass = UTILITY_SECONDARY;
  protected readonly utilDangerClass = UTILITY_DANGER;

  protected readonly categoryColor = computed<string | undefined>(() => {
    const cat = this.entry().category?.toLowerCase();
    if (!cat) return undefined;
    return this.categories.categoryByLabel().get(cat)?.color;
  });
  protected readonly coverUrl = computed(() => this.media.urlFor(this.entry().coverAssetId));
  protected readonly hasImage = computed(() => !!this.coverUrl());
}
