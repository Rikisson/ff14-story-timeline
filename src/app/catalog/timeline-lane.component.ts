import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { SortDirection } from './catalog-filters.component';
import { TimelineCard, TimelineLane } from './catalog-timeline-lanes';
import { TimelineTileComponent } from './timeline-tile.component';
import catalogEn from './i18n/en.json';
import catalogUk from './i18n/uk.json';

const SCROLL_STEP = 320;

@Component({
  selector: 'app-timeline-lane',
  imports: [TimelineTileComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'catalog',
      loader: {
        en: () => Promise.resolve(catalogEn),
        uk: () => Promise.resolve(catalogUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'catalog'">
      <section
        class="flex flex-col gap-2"
        role="region"
        [attr.aria-label]="lane().label || t('field.allItems')"
      >
        @if (lane().label) {
          <header class="flex items-center gap-2">
            @if (lane().color) {
              <span
                class="inline-block size-3 rounded-full"
                [style.background]="lane().color"
                aria-hidden="true"
              ></span>
            }
            <h3 class="m-0 text-sm font-semibold uppercase tracking-wide text-foreground-faint">
              {{ lane().label }}
            </h3>
            <span class="text-xs text-foreground-faint">
              ({{ lane().dated.length + lane().undated.length }})
            </span>
          </header>
        }

        @if (lane().dated.length === 0 && lane().undated.length === 0) {
          <p class="m-0 px-1 py-2 text-sm italic text-foreground-faint">{{ t('empty.noItemsLane') }}</p>
        } @else {
          <div
            #rail
            tabindex="0"
            class="flex items-stretch gap-4 overflow-x-auto rounded-md pb-2 [overscroll-behavior-x:contain] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            (keydown)="onRailKey($event)"
            (focusin)="onFocusIn($event)"
          >
            @for (card of visibleDated(); track card.id) {
              <div class="w-[320px] shrink-0">
                <app-timeline-tile
                  [card]="card"
                  [accentColor]="card.laneColor ?? null"
                />
              </div>
            }

            @if (visibleUndated().length > 0) {
              <div class="ml-2 flex shrink-0 flex-col gap-2 border-l-2 border-dashed border-border-strong pl-4">
                <p class="m-0 text-xs font-semibold uppercase tracking-wide text-foreground-faint">
                  {{ t('field.undated') }}
                </p>
                <div class="flex gap-3">
                  @for (card of visibleUndated(); track card.id) {
                    <div class="w-[300px] shrink-0">
                      <app-timeline-tile
                        [card]="card"
                        [accentColor]="card.laneColor ?? null"
                      />
                    </div>
                  }
                </div>
              </div>
            }

            @if (hasMore()) {
              <button
                type="button"
                class="flex w-12 shrink-0 items-stretch justify-center self-stretch rounded-md border border-border-strong bg-surface text-3xl font-light text-foreground-subtle transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                [attr.aria-label]="t('tooltip.loadMore', { lane: lane().label || t('field.allItems') })"
                (click)="loadMore.emit()"
              >
                <span class="flex items-center">›</span>
              </button>
            }
          </div>

          <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
        }
      </section>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineLaneComponent {
  readonly lane = input.required<TimelineLane>();
  readonly sortDirection = input<SortDirection>('asc');
  readonly pageSize = input.required<number>();
  readonly serverHasMore = input<boolean>(false);

  readonly loadMore = output<void>();

  protected readonly rail = viewChild<ElementRef<HTMLDivElement>>('rail');
  protected readonly announcement = signal('');

  protected readonly visibleDated = computed<TimelineCard[]>(() =>
    this.lane().dated.slice(0, this.pageSize()),
  );

  protected readonly visibleUndated = computed<TimelineCard[]>(() => {
    const remaining = Math.max(0, this.pageSize() - this.lane().dated.length);
    return this.lane().undated.slice(0, remaining);
  });

  protected readonly hasMore = computed(() => {
    const total = this.lane().dated.length + this.lane().undated.length;
    return this.pageSize() < total || this.serverHasMore();
  });

  protected onRailKey(event: KeyboardEvent): void {
    const el = this.rail()?.nativeElement;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
    switch (event.key) {
      case 'ArrowRight':
        el.scrollBy({ left: SCROLL_STEP, behavior });
        event.preventDefault();
        break;
      case 'ArrowLeft':
        el.scrollBy({ left: -SCROLL_STEP, behavior });
        event.preventDefault();
        break;
      case 'Home':
        el.scrollTo({ left: 0, behavior });
        event.preventDefault();
        break;
      case 'End':
        el.scrollTo({ left: el.scrollWidth, behavior });
        event.preventDefault();
        break;
    }
  }

  protected onFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || target === this.rail()?.nativeElement) return;
    target.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
}
