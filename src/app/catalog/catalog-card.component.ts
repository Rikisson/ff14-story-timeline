import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarService } from '@features/calendar';
import { CharactersService } from '@features/characters';
import { EventsService } from '@features/events';
import { PlacesService } from '@features/places';
import { Story, StoriesService } from '@features/stories';
import { isInGameDateEmpty } from '@shared/models';
import { EntityRefComponent, GhostButtonComponent, MarkdownTextComponent } from '@shared/ui';
import { formatInGameDate, InlineRefOption } from '@shared/utils';

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
  ],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
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
          <span
            class="absolute left-2 top-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white"
          >
            DRAFT
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
              <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{{ d }}</span>
            }
            @for (c of story().mainCharacters; track c.id) {
              <app-entity-ref [ref]="c" />
            }
            @for (p of story().places; track p.id) {
              <app-entity-ref [ref]="p" />
            }
          </div>
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

  readonly remove = output<string>();

  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);
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

  protected readonly inlineRefOptions = computed<InlineRefOption[]>(() => [
    ...this.characters.characters().map((c) => ({
      kind: 'character' as const,
      id: c.id,
      label: c.name,
      slug: c.slug,
    })),
    ...this.places.places().map((p) => ({
      kind: 'place' as const,
      id: p.id,
      label: p.name,
      slug: p.slug,
    })),
    ...this.events.events().map((e) => ({
      kind: 'event' as const,
      id: e.id,
      label: e.name,
      slug: e.slug,
    })),
    ...this.stories.publishedStories().map((s) => ({
      kind: 'story' as const,
      id: s.id,
      label: s.title,
      slug: s.slug,
    })),
  ]);

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
    return !isInGameDateEmpty(s.inGameDate) || s.mainCharacters.length > 0 || s.places.length > 0;
  });
}
