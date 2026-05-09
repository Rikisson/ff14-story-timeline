import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { MediaAssetsService } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import {
  DangerButtonComponent,
  EntityRefComponent,
  GhostButtonComponent,
} from '@shared/ui';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import { CodexEntry } from '../data-access/codex-entry.types';

@Component({
  selector: 'app-codex-entry-card',
  imports: [
    NgOptimizedImage,
    GhostButtonComponent,
    DangerButtonComponent,
    EntityRefComponent,
    TranslocoDirective,
    ContentLangDirective,
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
            <h3 appContentLang class="m-0 flex-1 text-lg font-semibold text-foreground">{{ entry().title }}</h3>
            <div class="flex shrink-0 items-center gap-2">
              @if (entry().category; as c) {
                <span
                  appContentLang
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                  [style.borderColor]="categoryColor() ?? 'var(--color-border-strong)'"
                  [style.color]="categoryColor() ?? 'var(--color-foreground-subtle)'"
                >{{ c }}</span>
              }
              @if (canEdit()) {
                <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
                <button uiDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
              }
            </div>
          </div>

          <p appContentLang class="m-0 whitespace-pre-line text-sm text-foreground-muted">
            {{ entry().description }}
          </p>

          @if ((entry().relatedRefs ?? []).length > 0) {
            <ul class="flex flex-wrap gap-1.5">
              @for (r of entry().relatedRefs ?? []; track r.kind + ':' + r.id) {
                <li>
                  <app-entity-ref [ref]="r" />
                </li>
              }
            </ul>
          }
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

  protected readonly categoryColor = computed<string | undefined>(() => {
    const cat = this.entry().category?.toLowerCase();
    if (!cat) return undefined;
    return this.categories.categoryByLabel().get(cat)?.color;
  });
  protected readonly coverUrl = computed(() => this.media.urlFor(this.entry().coverAssetId));
}
