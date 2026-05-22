import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { Story } from '@features/stories';
import { ContentLangDirective } from '@features/universes';
import { isInGameDateEmpty } from '@shared/models';
import {
  DangerButtonComponent,
  DetailCardComponent,
  EntityRefComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
  PrimaryButtonComponent,
  TagComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import storyEn from '../i18n/en.json';
import storyUk from '../i18n/uk.json';

@Component({
  selector: 'app-story-detail',
  imports: [
    RouterLink,
    DetailCardComponent,
    MarkdownTextComponent,
    EntityRefComponent,
    TagComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    DangerButtonComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'story',
      loader: {
        en: () => Promise.resolve(storyEn),
        uk: () => Promise.resolve(storyUk),
      },
    }),
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let t; prefix: 'story'">
      <app-detail-card [coverAssetId]="story().coverAssetId">
        @if (canEdit()) {
          <div class="flex shrink-0 items-center gap-2">
            <a uiGhost [routerLink]="['/edit', story().id]">{{ t('action.edit') }}</a>
            <button
              uiDanger
              type="button"
              [attr.aria-label]="t('tooltip.deleteStory', { title: storyTitle() })"
              (click)="confirmDelete()"
            >
              {{ t('action.delete') }}
            </button>
          </div>
        }

        <div appContentLang class="contents">
          <h2 class="m-0 font-display text-2xl font-semibold text-foreground">{{ storyTitle() }}</h2>

          @if (story().draft || formattedDate()) {
            <div class="flex flex-wrap items-center gap-2">
              @if (story().draft) {
                <app-tag tone="amber">{{ t('field.draftBadge') }}</app-tag>
              }
              @if (formattedDate(); as d) {
                <span class="text-xs font-medium uppercase tracking-wider text-foreground-muted">{{ d }}</span>
              }
            </div>
          }

          @if (story().description; as d) {
            <app-markdown-text
              class="text-sm text-foreground-muted"
              [text]="d"
              [inline]="true"
            />
          }

          @if (relatedRefs().length > 0) {
            <ul class="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
              @for (r of relatedRefs(); track r.kind + ':' + r.id) {
                <li><app-entity-ref [ref]="r" /></li>
              }
            </ul>
          }
        </div>

        <a
          uiPrimary
          class="mt-1 self-start"
          [routerLink]="['/reader/story', story().id]"
          [attr.aria-label]="t('tooltip.playStory', { title: storyTitle() })"
        >
          {{ t('action.playEmoji') }}
        </a>
      </app-detail-card>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryDetailComponent {
  readonly story = input.required<Story>();
  readonly canEdit = input<boolean>(false);

  readonly remove = output<string>();

  private readonly calendar = inject(CalendarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly storyTitle = computed(
    () => this.story().title || this.transloco.translate('story.field.untitled'),
  );

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

  protected confirmDelete(): void {
    if (
      window.confirm(
        this.transloco.translate('story.message.deleteConfirm', { title: this.storyTitle() }),
      )
    ) {
      this.remove.emit(this.story().id);
    }
  }
}
