import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { ContentLangDirective } from '@features/universes';
import {
  DangerButtonComponent,
  DetailCardComponent,
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import { TimelineEvent } from '../data-access/event.types';

@Component({
  selector: 'app-event-card',
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
      <app-detail-card [coverAssetId]="event().coverAssetId">
        @if (canEdit()) {
          <div class="flex shrink-0 items-center gap-2">
            <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
            <button uiDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
          </div>
        }

        <div appContentLang class="contents">
          <h2 class="m-0 font-display text-2xl font-semibold text-foreground">{{ event().name }}</h2>

          @if (formattedDate(); as d) {
            <span class="text-xs font-medium uppercase tracking-wider text-foreground-muted">{{ d }}</span>
          }

          @if (event().description; as desc) {
            <app-markdown-text class="max-w-prose text-sm text-foreground-muted" [text]="desc" />
          }

          @if (relatedRefs().length > 0) {
            <ul class="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
              @for (r of relatedRefs(); track r.kind + ':' + r.id) {
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
export class EventCardComponent {
  readonly event = input.required<TimelineEvent>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly calendar = inject(CalendarService);

  protected readonly relatedRefs = computed(() => this.event().relatedRefs ?? []);

  protected readonly formattedDate = computed(() => {
    const d = this.event().inGameDate;
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
      weekdayName: this.calendar.weekdayLookup(d),
    });
  });
}
