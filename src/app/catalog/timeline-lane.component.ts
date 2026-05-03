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
import { EventCardComponent } from '@features/events';
import { CatalogCardComponent } from './catalog-card.component';
import { SortDirection } from './catalog-filters.component';
import { TimelineCard, TimelineLane } from './catalog-timeline-lanes';

const SCROLL_STEP = 320;

@Component({
  selector: 'app-timeline-lane',
  imports: [CatalogCardComponent, EventCardComponent],
  template: `
    <section
      class="flex flex-col gap-2"
      role="region"
      [attr.aria-label]="lane().label || 'All timeline items'"
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
          <h3 class="m-0 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {{ lane().label }}
          </h3>
          <span class="text-xs text-slate-400">
            ({{ lane().dated.length + lane().undated.length }})
          </span>
        </header>
      }

      @if (lane().dated.length === 0 && lane().undated.length === 0) {
        <p class="m-0 px-1 py-2 text-sm italic text-slate-500">No items in this lane.</p>
      } @else {
        <div
          #rail
          tabindex="0"
          class="flex items-stretch gap-4 overflow-x-auto rounded-md pb-2 [overscroll-behavior-x:contain] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          (keydown)="onRailKey($event)"
          (focusin)="onFocusIn($event)"
        >
          @for (card of visibleDated(); track card.id) {
            <div class="w-[280px] shrink-0">
              @if (card.kind === 'story' && card.story) {
                <app-catalog-card
                  [story]="card.story"
                  [canEdit]="canManage()"
                  [accentColor]="card.laneColor ?? null"
                  [plotlineChips]="card.laneColor ? [] : card.plotlines"
                />
              } @else if (card.event) {
                <app-event-card
                  [event]="card.event"
                  [canEdit]="false"
                  [accentColor]="card.laneColor ?? null"
                  [plotlineChips]="card.laneColor ? [] : card.plotlines"
                />
              }
            </div>
          }

          @if (visibleUndated().length > 0) {
            <div class="ml-2 flex shrink-0 flex-col gap-2 border-l-2 border-dashed border-slate-300 pl-4">
              <p class="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Undated
              </p>
              <div class="flex gap-3">
                @for (card of visibleUndated(); track card.id) {
                  <div class="w-[260px] shrink-0">
                    @if (card.kind === 'story' && card.story) {
                      <app-catalog-card
                        [story]="card.story"
                        [canEdit]="canManage()"
                        [accentColor]="card.laneColor ?? null"
                        [plotlineChips]="card.laneColor ? [] : card.plotlines"
                      />
                    } @else if (card.event) {
                      <app-event-card
                        [event]="card.event"
                        [canEdit]="false"
                        [accentColor]="card.laneColor ?? null"
                        [plotlineChips]="card.laneColor ? [] : card.plotlines"
                      />
                    }
                  </div>
                }
              </div>
            </div>
          }

          @if (hasMore()) {
            <button
              type="button"
              class="flex w-12 shrink-0 items-stretch justify-center self-stretch rounded-md border border-slate-300 bg-white text-3xl font-light text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              [attr.aria-label]="'Load 25 more items into ' + (lane().label || 'lane')"
              (click)="loadMore.emit()"
            >
              <span class="flex items-center">›</span>
            </button>
          }
        </div>

        <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineLaneComponent {
  readonly lane = input.required<TimelineLane>();
  readonly sortDirection = input<SortDirection>('asc');
  readonly canManage = input<boolean>(false);
  readonly pageSize = input.required<number>();

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
    return this.pageSize() < total;
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
