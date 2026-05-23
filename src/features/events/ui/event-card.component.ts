import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { ContentLangDirective } from '@features/universes';
import {
  BookIconComponent,
  DangerButtonComponent,
  DetailCardComponent,
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import { TimelineEvent } from '../data-access/event.types';
import eventEn from '../i18n/en.json';
import eventUk from '../i18n/uk.json';

@Component({
  selector: 'app-event-card',
  imports: [
    RouterLink,
    DetailCardComponent,
    EntityRefComponent,
    MarkdownTextComponent,
    PrimaryButtonComponent,
    BookIconComponent,
    GhostButtonComponent,
    DangerButtonComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'event',
      loader: {
        en: () => Promise.resolve(eventEn),
        uk: () => Promise.resolve(eventUk),
      },
    }),
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <ng-container *transloco="let e; prefix: 'event'">
        <app-detail-card [coverAssetId]="event().coverAssetId">
          <div class="flex items-start justify-between gap-3">
            <h2 appContentLang class="m-0 min-w-0 flex-1 font-display text-2xl font-semibold text-foreground">{{ event().name }}</h2>
            @if (canEdit()) {
              <div class="flex shrink-0 items-center gap-2">
                <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
                <button uiDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
              </div>
            }
          </div>

          @if (formattedDate(); as d) {
            <span appContentLang class="text-xs font-medium uppercase tracking-wider text-foreground-muted">{{ d }}</span>
          }

          <a
            uiPrimary
            class="self-start"
            [routerLink]="['/reader/event', event().id]"
            [attr.aria-label]="e('tooltip.readEvent', { name: event().name })"
          >
            <app-book-icon icon-leading class="size-4" />
            {{ e('action.readNow') }}
          </a>

          <div appContentLang class="contents">
            @if (event().description; as desc) {
              <app-markdown-text class="text-sm text-foreground-muted" [text]="desc" />
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
