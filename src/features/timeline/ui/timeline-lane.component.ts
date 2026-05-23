import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import {
  createTimelineStreamStore,
  SortDirection,
  TimelineQueryStore,
  UNASSIGNED_LANE_KEY,
} from '@shared/data-access';
import { TimelineTileComponent } from './timeline-tile.component';
import timelineEn from '../i18n/en.json';
import timelineUk from '../i18n/uk.json';

const SCROLL_STEP = 320;

/**
 * Renders a single timeline stream — either the global stream (no
 * `laneKey`, reads `_timelineEntries`) or one per-lane stream (with
 * `laneKey`, reads `_timelineLaneEntries`). Owns its own
 * `TimelineQueryStore` instance, so per-lane cursors stay independent
 * per `docs/narrative-engine-impl.md` *Timeline UX*.
 *
 * Inputs are signals (or values that become signals via Angular's input
 * mechanism). Changing `sortDirection`, `universeId`, or `laneKey`
 * resets the lane's cursor and refetches page 1.
 */
@Component({
  selector: 'app-timeline-lane',
  imports: [TimelineTileComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'timeline',
      loader: {
        en: () => Promise.resolve(timelineEn),
        uk: () => Promise.resolve(timelineUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'timeline'">
      <section
        class="flex flex-col gap-2"
        role="region"
        [attr.aria-label]="ariaLabel(t)"
      >
        @if (showHeader()) {
          <header class="flex items-center gap-2">
            <h2 class="m-0 text-sm font-semibold uppercase tracking-wide text-foreground-faint">
              {{ headerLabel(t) }}
            </h2>
          </header>
        }

        @if (store.loading() && store.rows().length === 0) {
          <p class="m-0 px-1 py-2 text-sm italic text-foreground-faint" aria-live="polite">
            {{ tGeneral('message.loading') }}
          </p>
        } @else if (store.error()) {
          <p class="m-0 px-1 py-2 text-sm text-danger-foreground" role="alert">
            {{ tGeneral('message.refreshError', { resource: headerLabel(t) || t('field.allItems') }) }}
            <button
              type="button"
              class="ml-2 rounded border border-border px-2 py-0.5 text-xs"
              (click)="store.refresh()"
            >{{ tGeneral('action.retry') }}</button>
          </p>
        } @else if (store.rows().length === 0) {
          <p class="m-0 px-1 py-2 text-sm italic text-foreground-faint">{{ t('empty.noItemsLane') }}</p>
        } @else {
          <div
            #rail
            tabindex="0"
            class="flex items-stretch gap-4 overflow-x-auto rounded-md p-3 [overscroll-behavior-x:contain] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            [style.background]="color() || null"
            (keydown)="onRailKey($event)"
            (focusin)="onFocusIn($event)"
          >
            @for (row of store.rows(); track row.kind + ':' + row.id) {
              <div class="w-[320px] shrink-0">
                <app-timeline-tile [row]="row" />
              </div>
            }

            @if (store.hasMore()) {
              <button
                type="button"
                class="flex w-12 shrink-0 items-stretch justify-center self-stretch rounded-md border border-border-strong bg-surface text-3xl text-foreground-subtle transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring disabled:opacity-60"
                [disabled]="store.loadingMore()"
                [attr.aria-label]="t('tooltip.loadMore', { lane: headerLabel(t) || t('field.allItems') })"
                (click)="store.loadMore()"
              >
                <span class="flex items-center">{{ store.loadingMore() ? '…' : '›' }}</span>
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
  /** null = global stream over `_timelineEntries`; string = per-lane stream. */
  readonly laneKey = input<string | null>(null);
  readonly label = input<string>('');
  readonly color = input<string | undefined>(undefined);
  readonly sortDirection = input<SortDirection>('asc');
  readonly includeDrafts = input<boolean>(false);

  private readonly universes = inject(UniverseStore);
  private readonly auth = inject(AuthStore);
  protected readonly rail = viewChild<ElementRef<HTMLDivElement>>('rail');
  protected readonly announcement = signal('');

  protected readonly universeId = computed(() => this.universes.activeUniverseId());
  // Members may include drafts; the explicit input lets the parent override
  // (e.g. a public-only debug view), default-derive otherwise.
  protected readonly effectiveDrafts = computed(() => {
    if (this.includeDrafts()) return true;
    return !!this.auth.user() && this.universes.isMemberOfActive();
  });

  protected readonly isUnassigned = computed(() => this.laneKey() === UNASSIGNED_LANE_KEY);
  protected readonly showHeader = computed(() => !!this.label() || this.isUnassigned());

  // One factory, branched at query-build time inside the store. The
  // constructor must NOT branch on `this.laneKey()` directly — Angular
  // signal inputs aren't bound until change detection, so a constructor
  // read returns the initial value (`null`) for every instance and every
  // lane silently degrades to the global stream.
  protected readonly store: TimelineQueryStore = createTimelineStreamStore({
    universeId: this.universeId,
    includeDrafts: this.effectiveDrafts,
    sortDirection: this.sortDirection,
    laneKey: this.laneKey,
  });

  protected headerLabel(t: (key: string) => string): string {
    if (this.isUnassigned()) return t('field.unassigned');
    return this.label();
  }

  protected ariaLabel(t: (key: string) => string): string {
    if (this.isUnassigned()) return t('field.unassigned');
    return this.label() || t('field.allItems');
  }

  private readonly transloco = inject(TranslocoService);

  protected tGeneral(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate('general.' + key, params);
  }

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
