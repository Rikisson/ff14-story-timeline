import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { EntityRef } from '@shared/models';
import { TimelineRow } from '@shared/data-access';
import {
  BookIconComponent,
  DetailCardComponent,
  EntityKindIconComponent,
  EntityRefComponent,
  MarkdownTextComponent,
  PrimaryButtonComponent,
  TagComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import exploreEn from '../i18n/en.json';
import exploreUk from '../i18n/uk.json';

export interface ExploreReadNext {
  /** Maps to an `explore.action.*` key: connection vs. plotline-next. */
  labelKey: 'continuesIn' | 'leadsTo' | 'nextInPlotline';
  title: string;
  link: readonly [string, string];
  queryParams?: Record<string, string>;
}

export interface ExploreDetailVm {
  kind: 'story' | 'event';
  id: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  inGameDate: TimelineRow['inGameDate'];
  draft: boolean;
  /** Related people / places, rendered as entity chips. */
  refs: EntityRef[];
  /** Forward nudge: a wired connection or the next plotline member. */
  readNext?: ExploreReadNext;
}

/**
 * Detail pane for a selected story or event, matching the entity-card
 * convention: cover, a kind + date meta row, a "Read now" CTA into the
 * reader, the description, entity-ref chips, and — when one exists — a
 * "Read next" nudge to a wired continuation or the next plotline member.
 */
@Component({
  selector: 'app-explore-detail',
  host: { class: 'block h-full min-h-0' },
  imports: [
    BookIconComponent,
    DetailCardComponent,
    EntityKindIconComponent,
    EntityRefComponent,
    MarkdownTextComponent,
    PrimaryButtonComponent,
    RouterLink,
    TagComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'explore',
      loader: {
        en: () => Promise.resolve(exploreEn),
        uk: () => Promise.resolve(exploreUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'explore'">
      <ng-container *transloco="let g; prefix: 'general'">
      <app-detail-card [coverAssetId]="vm().coverAssetId">
        <div class="flex flex-wrap items-center gap-2">
          @if (vm().draft) {
            <app-tag tone="amber">{{ t('badge.draft') }}</app-tag>
          }
          <span class="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-foreground-muted">
            <app-entity-kind-icon class="size-3.5" [kind]="vm().kind" />
            <span>{{ kindLabel(t) }}</span>
            @if (formattedDate(); as d) {
              <span aria-hidden="true">·</span>
              <span>{{ d }}</span>
            }
          </span>
        </div>

        <h2 class="m-0 font-display text-2xl font-semibold text-foreground">
          {{ vm().title || t('field.untitled') }}
        </h2>

        <div class="flex flex-wrap items-center gap-2">
          <a uiPrimary class="self-start" [routerLink]="readLink()">
            <app-book-icon icon-leading class="size-4" />
            {{ g('action.readNow') }}
          </a>
          @if (vm().readNext; as next) {
            <a
              class="self-start text-sm font-medium text-accent underline-offset-2 hover:underline"
              [routerLink]="next.link"
              [queryParams]="next.queryParams ?? null"
            >{{ t('action.' + next.labelKey, { title: next.title }) }}</a>
          }
        </div>

        @if (vm().description; as desc) {
          <app-markdown-text class="text-sm text-foreground-muted" [text]="desc" />
        }

        @if (vm().refs.length) {
          <ul class="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
            @for (r of vm().refs; track r.kind + ':' + r.id) {
              <li><app-entity-ref [ref]="r" /></li>
            }
          </ul>
        }
      </app-detail-card>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreDetailComponent {
  readonly vm = input.required<ExploreDetailVm>();

  private readonly calendar = inject(CalendarService);

  protected readonly readLink = computed<readonly [string, string]>(() => {
    const v = this.vm();
    return v.kind === 'story' ? ['/reader/story', v.id] : ['/reader/event', v.id];
  });

  protected readonly formattedDate = computed(() => {
    const d = this.vm().inGameDate;
    return formatInGameDate(d, {
      eraName: d?.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d?.month ? this.calendar.monthNameLookup(d.month) : undefined,
      weekdayName: this.calendar.weekdayLookup(d),
    });
  });

  protected kindLabel(t: (key: string) => string): string {
    return t(this.vm().kind === 'story' ? 'kind.story' : 'kind.event');
  }
}
