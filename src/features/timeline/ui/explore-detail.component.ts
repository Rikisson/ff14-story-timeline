import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { TimelineRow } from '@shared/data-access';
import {
  DetailCardComponent,
  MarkdownTextComponent,
  PrimaryButtonComponent,
  TagComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import exploreEn from '../i18n/en.json';
import exploreUk from '../i18n/uk.json';

export interface ExploreDetailVm {
  kind: 'story' | 'event';
  id: string;
  title: string;
  description?: string;
  coverAssetId?: string;
  inGameDate: TimelineRow['inGameDate'];
  draft: boolean;
  plotlineIds: string[];
}

export interface ExplorePlotlineChip {
  id: string;
  title: string;
  color?: string;
}

/**
 * Detail pane for a selected story or event. Cover on the right, text on
 * the left (the shared `DetailCard` convention), with a Read CTA into the
 * reader. The richer "continues / next in arc" nudge is deferred until the
 * connections model lands; today the nudge is the Read action plus the
 * arc chips.
 */
@Component({
  selector: 'app-explore-detail',
  host: { class: 'block h-full min-h-0' },
  imports: [
    DetailCardComponent,
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
      <app-detail-card [coverAssetId]="vm().coverAssetId">
        <div class="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-foreground-faint">
          <span class="inline-flex items-center gap-1.5">
            <span aria-hidden="true">{{ vm().kind === 'story' ? '📖' : '◆' }}</span>
            {{ kindLabel(t) }}
          </span>
          @if (formattedDate()) {
            <span aria-hidden="true">·</span>
            <span>{{ formattedDate() }}</span>
          }
          @if (vm().draft) {
            <app-tag tone="amber">{{ t('badge.draft') }}</app-tag>
          }
        </div>

        <h2 class="m-0 font-display text-2xl font-semibold text-foreground">
          {{ vm().title || t('field.untitled') }}
        </h2>

        @if (plotlines().length) {
          <div class="flex flex-wrap gap-1.5">
            @for (p of plotlines(); track p.id) {
              <app-tag tone="sky">{{ p.title }}</app-tag>
            }
          </div>
        }

        @if (vm().description; as desc) {
          <app-markdown-text class="text-sm text-foreground-subtle" [text]="desc" />
        }

        <div class="pt-2">
          <a uiPrimary [routerLink]="readLink()">{{ t('action.read') }}</a>
        </div>
      </app-detail-card>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreDetailComponent {
  readonly vm = input.required<ExploreDetailVm>();
  readonly plotlines = input<ExplorePlotlineChip[]>([]);

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
