import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CalendarService } from '@features/calendar';
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
  imports: [GhostButtonComponent, DangerButtonComponent, EntityRefComponent, TagComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg bg-amber-50/40 p-4 shadow-sm"
      [class.border]="!accentColor()"
      [class.border-amber-200]="!accentColor()"
      [class.border-l-4]="!!accentColor()"
      [class.border-y]="!!accentColor()"
      [class.border-r]="!!accentColor()"
      [class.border-amber-100]="!!accentColor()"
      [style.borderLeftColor]="accentColor()"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="m-0 flex-1 text-lg font-semibold text-slate-900">{{ event().name }}</h3>
        <div class="flex shrink-0 items-center gap-2">
          <app-tag tone="amber" aria-label="Event entry">Event</app-tag>
          @if (canEdit()) {
            <button uiGhost type="button" (click)="edit.emit()">Edit</button>
            <button uiDanger type="button" (click)="remove.emit()">Delete</button>
          }
        </div>
      </div>

      @if (formattedDate(); as d) {
        <p class="m-0 text-xs font-medium uppercase tracking-wide text-amber-700">{{ d }}</p>
      }

      @if (event().description; as desc) {
        <p class="m-0 line-clamp-4 whitespace-pre-line text-sm text-slate-700">{{ desc }}</p>
      }

      @if (
        event().mainCharacters.length || event().places.length || event().relatedDates.length
      ) {
        <div class="flex flex-wrap gap-1.5">
          @for (c of event().mainCharacters; track c.id) {
            <app-entity-ref [ref]="c" />
          }
          @for (p of event().places; track p.id) {
            <app-entity-ref [ref]="p" />
          }
          @for (d of event().relatedDates; track d) {
            <app-tag>{{ d }}</app-tag>
          }
        </div>
      }

      @if (plotlineChips().length > 0) {
        <ul class="m-0 flex list-none flex-wrap gap-1 p-0">
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

  protected readonly formattedDate = computed(() => {
    const d = this.event().inGameDate;
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
    });
  });
}
