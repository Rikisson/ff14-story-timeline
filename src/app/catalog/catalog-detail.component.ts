import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
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
import catalogEn from './i18n/en.json';
import catalogUk from './i18n/uk.json';

const HERO_BASE =
  'inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
const HERO_PRIMARY =
  HERO_BASE +
  ' bg-accent text-accent-foreground shadow-lg hover:bg-accent-hover active:bg-accent-active focus-visible:ring-accent-ring';
const HERO_SECONDARY =
  HERO_BASE +
  ' bg-surface/90 text-foreground shadow hover:bg-surface active:bg-surface-muted focus-visible:ring-accent-ring';

@Component({
  selector: 'app-catalog-detail',
  imports: [
    RouterLink,
    MarkdownTextComponent,
    GhostButtonComponent,
    EntityRefComponent,
    TagComponent,
    TranslocoDirective,
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
  host: { class: 'block' },
  template: `
    <ng-container *transloco="let t; prefix: 'catalog'">
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
              class="size-full bg-gradient-to-br from-tone-indigo-border to-surface-stronger"
              aria-hidden="true"
            ></div>
          }
          <div
            class="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/40 to-scrim/20"
            aria-hidden="true"
          ></div>

          @if (story().draft) {
            <span class="absolute left-3 top-3">
              <app-tag tone="amber">{{ t('field.draftBadge') }}</app-tag>
            </span>
          }

          <div
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <h2 class="m-0 text-2xl font-bold text-scrim-foreground drop-shadow-md sm:text-3xl">
              {{ storyTitle() }}
            </h2>
            @if (story().description; as d) {
              <app-markdown-text
                class="line-clamp-3 max-w-2xl text-sm text-scrim-foreground/90 drop-shadow"
                [text]="d"
                [options]="inlineRefOptions()"
                [inline]="true"
              />
            }
            <div class="mt-1 flex flex-wrap items-center justify-center gap-2">
              <a
                [routerLink]="['/play', story().id]"
                [class]="heroPrimaryClass"
                [attr.aria-label]="t('tooltip.playStory', { title: storyTitle() })"
              >
                {{ t('action.playEmoji') }}
              </a>
              @if (canEdit()) {
                <a [routerLink]="['/edit', story().id]" [class]="heroSecondaryClass">{{ t('action.edit') }}</a>
                <button
                  uiGhost
                  type="button"
                  class="bg-surface/15 text-foreground hover:bg-surface/25"
                  [attr.aria-label]="t('tooltip.deleteStory', { title: storyTitle() })"
                  (click)="confirmDelete()"
                >
                  {{ t('action.delete') }}
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
  protected readonly heroSecondaryClass = HERO_SECONDARY;

  protected readonly storyTitle = computed(
    () => this.story().title || this.transloco.translate('catalog.field.untitled'),
  );

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
    if (
      window.confirm(
        this.transloco.translate('catalog.message.deleteConfirm', { title: this.storyTitle() }),
      )
    ) {
      this.remove.emit(this.story().id);
    }
  }
}
