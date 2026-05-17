import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { ContentLangDirective } from '@features/universes';
import { AssetThumbResolver } from '@shared/data-access';
import { EntityRefComponent, UTILITY_DANGER, UTILITY_SECONDARY } from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import { TimelineEvent } from '../data-access/event.types';

@Component({
  selector: 'app-event-card',
  imports: [
    NgOptimizedImage,
    EntityRefComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <article
        class="relative h-full w-full overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
      >
        @if (coverUrl(); as u) {
          <img
            [ngSrc]="u"
            alt=""
            fill
            class="absolute inset-0 object-cover"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/40 to-scrim/20"
            aria-hidden="true"
          ></div>
        }

        @if (canEdit()) {
          <div class="absolute right-3 top-3 z-20 flex items-center gap-2">
            <button type="button" [class]="utilSecondaryClass" (click)="edit.emit()">{{ g('action.edit') }}</button>
            <button type="button" [class]="utilDangerClass" (click)="remove.emit()">{{ g('action.delete') }}</button>
          </div>
        }

        <div
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-12 text-center"
        >
          <div appContentLang class="contents">
            <h2
              class="m-0 text-2xl font-bold sm:text-3xl"
              [class.text-scrim-foreground]="hasImage()"
              [class.drop-shadow-md]="hasImage()"
              [class.text-foreground]="!hasImage()"
            >{{ event().name }}</h2>

            @if (formattedDate(); as d) {
              <p
                class="m-0 text-xs font-medium uppercase tracking-wider"
                [class.text-scrim-foreground]="hasImage()"
                [class.drop-shadow]="hasImage()"
                [class.text-foreground-muted]="!hasImage()"
              >{{ d }}</p>
            }

            @if (event().description; as desc) {
              <p
                class="m-0 max-w-2xl whitespace-pre-line text-sm line-clamp-6"
                [class.text-scrim-foreground]="hasImage()"
                [class.drop-shadow]="hasImage()"
                [class.text-foreground-muted]="!hasImage()"
              >{{ desc }}</p>
            }

            @if (relatedRefs().length > 0) {
              <ul class="m-0 flex list-none flex-wrap items-center justify-center gap-1.5 p-0">
                @for (r of relatedRefs(); track r.kind + ':' + r.id) {
                  <li><app-entity-ref [ref]="r" /></li>
                }
              </ul>
            }
          </div>

        </div>
      </article>
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
  private readonly assets = inject(AssetThumbResolver);

  protected readonly utilSecondaryClass = UTILITY_SECONDARY;
  protected readonly utilDangerClass = UTILITY_DANGER;

  protected readonly relatedRefs = computed(() => this.event().relatedRefs ?? []);
  protected readonly coverUrl = computed(() => {
    const t = this.assets.resolve(this.event().coverAssetId)();
    return t?.thumbUrl ?? t?.url;
  });
  protected readonly hasImage = computed(() => !!this.coverUrl());

  protected readonly formattedDate = computed(() => {
    const d = this.event().inGameDate;
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
      weekdayName: this.calendar.weekdayLookup(d),
    });
  });
}
