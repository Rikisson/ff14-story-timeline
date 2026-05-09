import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarService } from '@features/calendar';
import { MediaAssetsService } from '@features/media';
import { Story } from '@features/stories';
import { EntityResolverService } from '@shared/data-access';
import { isInGameDateEmpty } from '@shared/models';
import {
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
  TagComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';

@Component({
  selector: 'app-catalog-card',
  imports: [
    RouterLink,
    NgOptimizedImage,
    MarkdownTextComponent,
    GhostButtonComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    EntityRefComponent,
    TagComponent,
  ],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col overflow-hidden rounded-lg bg-surface shadow-sm"
      [class.border]="!accentColor()"
      [class.border-border]="!accentColor()"
      [class.border-l-4]="!!accentColor()"
      [class.border-y]="!!accentColor()"
      [class.border-r]="!!accentColor()"
      [class.border-surface-muted]="!!accentColor()"
      [style.borderLeftColor]="accentColor()"
    >
      <a
        [routerLink]="['/play', story().id]"
        [attr.aria-label]="'Play ' + story().title"
        class="group relative block aspect-video overflow-hidden bg-surface-strong"
      >
        @if (background(); as bg) {
          <img
            [ngSrc]="bg"
            alt=""
            fill
            class="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        } @else {
          <div
            class="flex size-full items-center justify-center bg-gradient-to-br from-tone-indigo-border to-surface-stronger"
          ></div>
        }
        <span
          class="absolute inset-0 flex items-center justify-center bg-scrim/20 opacity-80 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <span
            class="flex size-16 items-center justify-center rounded-full bg-surface/90 text-tone-indigo-foreground shadow-lg"
          >
            <svg viewBox="0 0 24 24" class="ml-1 size-8 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        @if (story().draft) {
          <span class="absolute left-2 top-2">
            <app-tag tone="amber">DRAFT</app-tag>
          </span>
        }
      </a>

      <div class="flex flex-1 flex-col gap-2 px-4 py-3">
        <h3 class="m-0 text-lg font-semibold text-foreground">
          {{ story().title || 'Untitled' }}
        </h3>
        @if (story().description; as d) {
          <app-markdown-text
            class="line-clamp-3 text-sm text-foreground-subtle"
            [text]="d"
            [options]="inlineRefOptions()"
            [inline]="true"
          />
        }
        @if (tagsVisible()) {
          <div class="mt-auto flex flex-wrap gap-1.5 pt-1">
            @if (formattedDate(); as d) {
              <app-tag>{{ d }}</app-tag>
            }
            @for (r of relatedRefs(); track r.kind + ':' + r.id) {
              <app-entity-ref [ref]="r" />
            }
          </div>
        }
        @if (plotlineChips().length > 0) {
          <ul class="m-0 flex list-none flex-wrap gap-1 p-0 pt-1">
            @for (p of plotlineChips(); track p.id) {
              <li>
                <span
                  class="inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  [style.borderColor]="p.color ?? 'var(--color-border-strong)'"
                  [style.color]="p.color ?? 'var(--color-foreground-subtle)'"
                >{{ p.label }}</span>
              </li>
            }
          </ul>
        }
      </div>

      <div class="flex gap-2 border-t border-surface-muted px-4 py-3">
        <a uiPrimary [routerLink]="['/play', story().id]" class="flex-1">Play</a>
        @if (canEdit()) {
          <a uiSecondary [routerLink]="['/edit', story().id]" class="flex-1">Edit</a>
          <button
            uiGhost
            type="button"
            class="text-danger-foreground hover:bg-danger"
            [attr.aria-label]="'Delete ' + story().title"
            (click)="confirmDelete()"
          >
            Delete
          </button>
        }
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogCardComponent {
  readonly story = input.required<Story>();
  readonly canEdit = input<boolean>(false);
  readonly accentColor = input<string | null>(null);
  readonly plotlineChips = input<{ id: string; label: string; color?: string }[]>([]);

  readonly remove = output<string>();

  private readonly entityResolver = inject(EntityResolverService);
  private readonly calendar = inject(CalendarService);
  private readonly media = inject(MediaAssetsService);

  protected confirmDelete(): void {
    const s = this.story();
    const ok = window.confirm(
      `Delete "${s.title || 'Untitled'}"? This cannot be undone.`,
    );
    if (ok) this.remove.emit(s.id);
  }

  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly background = computed(() => this.media.urlFor(this.story().coverAssetId));

  protected readonly formattedDate = computed(() => {
    const d = this.story().inGameDate;
    if (isInGameDateEmpty(d)) return '';
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
      weekdayName: this.calendar.weekdayLookup(d),
    });
  });

  protected readonly relatedRefs = computed(() => this.story().relatedRefs ?? []);

  protected readonly tagsVisible = computed(() => {
    const s = this.story();
    return !isInGameDateEmpty(s.inGameDate) || (s.relatedRefs ?? []).length > 0;
  });
}
