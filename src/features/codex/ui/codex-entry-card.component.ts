import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ContentLangDirective } from '@features/universes';
import {
  DangerButtonComponent,
  DetailCardComponent,
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
} from '@shared/ui';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import { CodexEntry } from '../data-access/codex-entry.types';

@Component({
  selector: 'app-codex-entry-card',
  imports: [
    DetailCardComponent,
    EntityRefComponent,
    MarkdownTextComponent,
    GhostButtonComponent,
    DangerButtonComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <app-detail-card [coverAssetId]="entry().coverAssetId">
        @if (canEdit()) {
          <div class="flex shrink-0 items-center gap-2">
            <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
            <button uiDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
          </div>
        }

        <div appContentLang class="contents">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="m-0 font-display text-2xl font-semibold text-foreground">{{ entry().title }}</h2>
            @if (categoryLabel(); as c) {
              <span
                class="inline-flex items-center rounded-full border bg-surface-muted px-2 py-0.5 text-xs font-medium"
                [style.borderColor]="categoryColor() ?? 'var(--color-border-strong)'"
                [style.color]="categoryColor() ?? 'var(--color-foreground-subtle)'"
              >{{ c }}</span>
            }
          </div>

          @if (entry().description; as desc) {
            <app-markdown-text class="max-w-prose text-sm text-foreground-muted" [text]="desc" />
          }

          @if ((entry().relatedRefs ?? []).length > 0) {
            <ul class="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
              @for (r of entry().relatedRefs ?? []; track r.kind + ':' + r.id) {
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
export class CodexEntryCardComponent {
  readonly entry = input.required<CodexEntry>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly categories = inject(CodexCategoriesService);

  private readonly resolvedCategory = computed(() => {
    const key = this.entry().categoryKey;
    if (!key) return null;
    return this.categories.categoryByKey().get(key) ?? null;
  });
  protected readonly categoryLabel = computed(() => this.resolvedCategory()?.label);
  protected readonly categoryColor = computed(() => this.resolvedCategory()?.color);
}
