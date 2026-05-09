import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CalendarService } from '@features/calendar';
import { MediaAssetsService } from '@features/media';
import {
  DangerButtonComponent,
  EntityRefComponent,
  GhostButtonComponent,
  TagComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import { TimelineEvent } from '../data-access/event.types';

@Component({
  selector: 'app-event-card',
  imports: [
    NgOptimizedImage,
    GhostButtonComponent,
    DangerButtonComponent,
    EntityRefComponent,
    TagComponent,
  ],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col overflow-hidden rounded-lg bg-amber-50/40 dark:bg-amber-950/30 shadow-sm"
      [class.border]="!accentColor()"
      [class.border-amber-200]="!accentColor()"
      [class.dark:border-amber-900/50]="!accentColor()"
      [class.border-l-4]="!!accentColor()"
      [class.border-y]="!!accentColor()"
      [class.border-r]="!!accentColor()"
      [class.border-amber-100]="!!accentColor()"
      [class.dark:border-amber-900/50]="!!accentColor()"
      [style.borderLeftColor]="accentColor()"
    >
      @if (coverUrl(); as u) {
        <div class="relative aspect-video w-full bg-amber-100/40 dark:bg-amber-950/40">
          <img [ngSrc]="u" alt="" fill class="object-cover" />
        </div>
      }
      <div class="flex flex-1 flex-col gap-3 p-4">
        <div class="flex items-start justify-between gap-2">
          <h3 class="m-0 flex-1 text-lg font-semibold text-foreground">{{ event().name }}</h3>
          <div class="flex shrink-0 items-center gap-2">
            <app-tag tone="amber" aria-label="Event entry">Event</app-tag>
            @if (canEdit()) {
              <button uiGhost type="button" (click)="edit.emit()">Edit</button>
              <button uiDanger type="button" (click)="remove.emit()">Delete</button>
            }
          </div>
        </div>

        @if (formattedDate(); as d) {
          <p class="m-0 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">{{ d }}</p>
        }

        @if (event().description; as desc) {
          <p class="m-0 line-clamp-4 whitespace-pre-line text-sm text-foreground-muted">{{ desc }}</p>
        }

        @if (relatedRefs().length > 0) {
          <div class="flex flex-wrap gap-1.5">
            @for (r of relatedRefs(); track r.kind + ':' + r.id) {
              <app-entity-ref [ref]="r" />
            }
          </div>
        }

        @if (plotlineChips().length > 0) {
          <ul class="m-0 flex list-none flex-wrap gap-1 p-0">
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
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventCardComponent {
  readonly event = input.required<TimelineEvent>();
  readonly canEdit = input<boolean>(false);
  readonly accentColor = input<string | null>(null);
  readonly plotlineChips = input<{ id: string; label: string; color?: string }[]>([]);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly calendar = inject(CalendarService);
  private readonly media = inject(MediaAssetsService);

  protected readonly relatedRefs = computed(() => this.event().relatedRefs ?? []);
  protected readonly coverUrl = computed(() => this.media.urlFor(this.event().coverAssetId));

  protected readonly formattedDate = computed(() => {
    const d = this.event().inGameDate;
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
      weekdayName: this.calendar.weekdayLookup(d),
    });
  });
}
