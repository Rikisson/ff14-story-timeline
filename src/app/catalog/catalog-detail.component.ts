import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { MediaAssetsService } from '@features/media';
import { Story } from '@features/stories';
import { ContentLangDirective } from '@features/universes';
import { EntityResolverService } from '@shared/data-access';
import { isInGameDateEmpty } from '@shared/models';
import {
  EntityRefComponent,
  HERO_PRIMARY,
  MarkdownTextComponent,
  TagComponent,
  UTILITY_DANGER,
  UTILITY_SECONDARY,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import catalogEn from './i18n/en.json';
import catalogUk from './i18n/uk.json';

@Component({
  selector: 'app-catalog-detail',
  imports: [
    NgOptimizedImage,
    RouterLink,
    MarkdownTextComponent,
    EntityRefComponent,
    TagComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'catalog',
      loader: {
        en: () => Promise.resolve(catalogEn),
        uk: () => Promise.resolve(catalogUk),
      },
    }),
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let t; prefix: 'catalog'">
      <article
        class="relative h-full w-full overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
      >
        @if (background(); as u) {
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

        @if (story().draft) {
          <span class="absolute left-3 top-3 z-10">
            <app-tag tone="amber">{{ t('field.draftBadge') }}</app-tag>
          </span>
        }

        @if (canEdit()) {
          <div class="absolute right-3 top-3 z-20 flex items-center gap-2">
            <a [routerLink]="['/edit', story().id]" [class]="utilSecondaryClass">{{ t('action.edit') }}</a>
            <button
              type="button"
              [class]="utilDangerClass"
              [attr.aria-label]="t('tooltip.deleteStory', { title: storyTitle() })"
              (click)="confirmDelete()"
            >
              {{ t('action.delete') }}
            </button>
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
            >{{ storyTitle() }}</h2>

            @if (formattedDate(); as d) {
              <p
                class="m-0 text-xs font-medium uppercase tracking-wider"
                [class.text-scrim-foreground]="hasImage()"
                [class.drop-shadow]="hasImage()"
                [class.text-foreground-muted]="!hasImage()"
              >{{ d }}</p>
            }

            @if (story().description; as d) {
              <app-markdown-text
                class="line-clamp-6 max-w-2xl text-sm"
                [class.text-scrim-foreground]="hasImage()"
                [class.drop-shadow]="hasImage()"
                [class.text-foreground-muted]="!hasImage()"
                [text]="d"
                [options]="inlineRefOptions()"
                [inline]="true"
              />
            }

            @if (relatedRefs().length > 0) {
              <ul class="m-0 flex list-none flex-wrap items-center justify-center gap-1.5 p-0">
                @for (r of relatedRefs(); track r.kind + ':' + r.id) {
                  <li><app-entity-ref [ref]="r" /></li>
                }
              </ul>
            }
          </div>

          <div class="mt-1 flex flex-wrap items-center justify-center gap-2">
            <a
              [routerLink]="['/play', story().id]"
              [class]="heroPrimaryClass"
              [attr.aria-label]="t('tooltip.playStory', { title: storyTitle() })"
            >
              {{ t('action.playEmoji') }}
            </a>
          </div>
        </div>
      </article>
    </ng-container>
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
  private readonly transloco = inject(TranslocoService);

  protected readonly heroPrimaryClass = HERO_PRIMARY;
  protected readonly utilSecondaryClass = UTILITY_SECONDARY;
  protected readonly utilDangerClass = UTILITY_DANGER;

  protected readonly storyTitle = computed(
    () => this.story().title || this.transloco.translate('catalog.field.untitled'),
  );

  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly background = computed(() => this.media.urlFor(this.story().coverAssetId));
  protected readonly hasImage = computed(() => !!this.background());

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
        this.transloco.translate('catalog.message.deleteConfirm', { title: this.storyTitle() }),
      )
    ) {
      this.remove.emit(this.story().id);
    }
  }
}
