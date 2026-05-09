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
  TagComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';

const BTN_BASE =
  'inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
const BTN_PRIMARY =
  BTN_BASE +
  ' bg-accent text-accent-foreground shadow-lg hover:bg-accent-hover active:bg-accent-active focus-visible:ring-accent-ring';
const BTN_SECONDARY =
  BTN_BASE +
  ' bg-white/90 text-slate-900 shadow hover:bg-white active:bg-slate-100 focus-visible:ring-slate-400';

@Component({
  selector: 'app-catalog-detail',
  imports: [
    RouterLink,
    MarkdownTextComponent,
    GhostButtonComponent,
    EntityRefComponent,
    TagComponent,
  ],
  host: { class: 'block' },
  template: `
    <article
      class="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      <div
        class="relative aspect-[2/1] max-h-80 w-full overflow-hidden bg-surface-strong"
        [style.backgroundImage]="background() ? 'url(' + background() + ')' : null"
        [style.backgroundSize]="'cover'"
        [style.backgroundPosition]="'center'"
      >
        @if (!background()) {
          <div
            class="size-full bg-gradient-to-br from-indigo-200 to-slate-300"
            aria-hidden="true"
          ></div>
        }
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"
          aria-hidden="true"
        ></div>

        @if (story().draft) {
          <span class="absolute left-3 top-3">
            <app-tag tone="amber">DRAFT</app-tag>
          </span>
        }

        <div
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <h2 class="m-0 text-2xl font-bold text-white drop-shadow-md sm:text-3xl">
            {{ story().title || 'Untitled' }}
          </h2>
          @if (story().description; as d) {
            <app-markdown-text
              class="line-clamp-3 max-w-2xl text-sm text-white/90 drop-shadow"
              [text]="d"
              [options]="inlineRefOptions()"
              [inline]="true"
            />
          }
          <div class="mt-1 flex flex-wrap items-center justify-center gap-2">
            <a
              [routerLink]="['/play', story().id]"
              [class]="primaryClass"
              [attr.aria-label]="'Play ' + story().title"
            >
              ▶ Play
            </a>
            @if (canEdit()) {
              <a [routerLink]="['/edit', story().id]" [class]="secondaryClass">Edit</a>
              <button
                uiGhost
                type="button"
                class="bg-white/15 text-white hover:bg-white/25"
                [attr.aria-label]="'Delete ' + story().title"
                (click)="confirmDelete()"
              >
                Delete
              </button>
            }
          </div>
        </div>
      </div>

      @if (tagsVisible()) {
        <div class="flex flex-wrap gap-1.5 px-4 py-3">
          @if (formattedDate(); as d) {
            <app-tag>{{ d }}</app-tag>
          }
          @for (r of relatedRefs(); track r.kind + ':' + r.id) {
            <app-entity-ref [ref]="r" />
          }
        </div>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogDetailComponent {
  readonly story = input.required<Story>();
  readonly canEdit = input<boolean>(false);

  readonly remove = output<string>();

  private readonly entityResolver = inject(EntityResolverService);
  private readonly calendar = inject(CalendarService);
  private readonly media = inject(MediaAssetsService);

  protected readonly primaryClass = BTN_PRIMARY;
  protected readonly secondaryClass = BTN_SECONDARY;

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

  protected confirmDelete(): void {
    const s = this.story();
    if (window.confirm(`Delete "${s.title || 'Untitled'}"? This cannot be undone.`)) {
      this.remove.emit(s.id);
    }
  }
}
