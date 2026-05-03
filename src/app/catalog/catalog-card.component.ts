import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarService } from '@features/calendar';
import { Story } from '@features/stories';
import { EntityResolverService } from '@shared/data-access';
import { isInGameDateEmpty } from '@shared/models';
import {
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
  TagComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';

const BTN_BASE =
  'inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
const BTN_PRIMARY =
  BTN_BASE +
  ' bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 focus-visible:ring-indigo-500';
const BTN_SECONDARY =
  BTN_BASE +
  ' bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400';

@Component({
  selector: 'app-catalog-card',
  imports: [
    RouterLink,
    NgOptimizedImage,
    MarkdownTextComponent,
    GhostButtonComponent,
    EntityRefComponent,
    TagComponent,
  ],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-sm"
      [class.border]="!accentColor()"
      [class.border-slate-200]="!accentColor()"
      [class.border-l-4]="!!accentColor()"
      [class.border-y]="!!accentColor()"
      [class.border-r]="!!accentColor()"
      [class.border-slate-100]="!!accentColor()"
      [style.borderLeftColor]="accentColor()"
    >
      <a
        [routerLink]="['/play', story().id]"
        [attr.aria-label]="'Play ' + story().title"
        class="group relative block aspect-video overflow-hidden bg-slate-200"
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
            class="flex size-full items-center justify-center bg-gradient-to-br from-indigo-200 to-slate-300"
          ></div>
        }
        <span
          class="absolute inset-0 flex items-center justify-center bg-black/20 opacity-80 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <span
            class="flex size-16 items-center justify-center rounded-full bg-white/90 text-indigo-700 shadow-lg"
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
        <h3 class="m-0 text-lg font-semibold text-slate-900">
          {{ story().title || 'Untitled' }}
        </h3>
        @if (story().summary; as s) {
          <app-markdown-text
            class="line-clamp-3 text-sm text-slate-600"
            [text]="s"
            [options]="inlineRefOptions()"
            [inline]="true"
          />
        }
        @if (tagsVisible()) {
          <div class="mt-auto flex flex-wrap gap-1.5 pt-1">
            @if (formattedDate(); as d) {
              <app-tag>{{ d }}</app-tag>
            }
            @for (c of story().mainCharacters; track c.id) {
              <app-entity-ref [ref]="c" />
            }
            @for (p of story().places; track p.id) {
              <app-entity-ref [ref]="p" />
            }
            @for (g of story().genreTags ?? []; track g) {
              <app-tag>{{ g }}</app-tag>
            }
            @for (t of story().toneTags ?? []; track t) {
              <app-tag>{{ t }}</app-tag>
            }
          </div>
        }
        @if (plotlineChips().length > 0) {
          <ul class="m-0 flex list-none flex-wrap gap-1 p-0 pt-1">
            @for (p of plotlineChips(); track p.id) {
              <li>
                <span
                  class="inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  [style.borderColor]="p.color ?? '#94a3b8'"
                  [style.color]="p.color ?? '#475569'"
                >{{ p.label }}</span>
              </li>
            }
          </ul>
        }
      </div>

      <div class="flex gap-2 border-t border-slate-100 px-4 py-3">
        <a [routerLink]="['/play', story().id]" [class]="primaryClass">Play</a>
        @if (canEdit()) {
          <a [routerLink]="['/edit', story().id]" [class]="secondaryClass">Edit</a>
          <button
            uiGhost
            type="button"
            class="text-red-700 hover:bg-red-50"
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

  protected confirmDelete(): void {
    const s = this.story();
    const ok = window.confirm(
      `Delete "${s.title || 'Untitled'}"? This cannot be undone.`,
    );
    if (ok) this.remove.emit(s.id);
  }

  protected readonly primaryClass = BTN_PRIMARY;
  protected readonly secondaryClass = BTN_SECONDARY;

  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly background = computed(() => {
    const s = this.story();
    return s.coverImage ?? s.scenes[s.startSceneId]?.background;
  });

  protected readonly formattedDate = computed(() => {
    const d = this.story().inGameDate;
    if (isInGameDateEmpty(d)) return '';
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
    });
  });

  protected readonly tagsVisible = computed(() => {
    const s = this.story();
    return (
      !isInGameDateEmpty(s.inGameDate) ||
      s.mainCharacters.length > 0 ||
      s.places.length > 0 ||
      (s.genreTags ?? []).length > 0 ||
      (s.toneTags ?? []).length > 0
    );
  });
}
