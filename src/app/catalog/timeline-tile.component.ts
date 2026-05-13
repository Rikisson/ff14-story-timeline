import { NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CalendarService } from '@features/calendar';
import { MediaAssetsService } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { TagComponent } from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import { TimelineCard } from './catalog-timeline-lanes';
import catalogEn from './i18n/en.json';
import catalogUk from './i18n/uk.json';

// Prefetch the full-resolution cover when the tile is comfortably inside the
// viewport. Stories navigate to /play which renders the full image as the page
// background — without this prefetch the click feels laggy on slow connections.
// Events have nowhere to navigate, so they're skipped at the call site.
const PREFETCH_VISIBLE_THRESHOLD = 0.5;

@Component({
  selector: 'app-timeline-tile',
  imports: [
    NgOptimizedImage,
    RouterLink,
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
      <div
        #root
        class="group relative aspect-video w-full overflow-hidden rounded-md bg-surface-strong shadow-sm"
        [class.border]="!accentColor()"
        [class.border-border]="!accentColor()"
        [class.border-l-4]="!!accentColor()"
        [class.border-y]="!!accentColor()"
        [class.border-r]="!!accentColor()"
        [class.border-surface-muted]="!!accentColor()"
        [style.borderLeftColor]="accentColor()"
      >
        <!-- 12px-wide WebP blur as CSS background. Fills the tile until the
             real thumb decodes, eliminating the flash of an empty card on scroll. -->
        <div
          class="absolute inset-0 bg-cover bg-center"
          [style.background-image]="blurBgImage()"
          aria-hidden="true"
        ></div>

        @if (thumbUrl(); as u) {
          <img
            [ngSrc]="u"
            alt=""
            fill
            sizes="320px"
            class="absolute inset-0 object-cover"
          />
        } @else {
          <div
            class="absolute inset-0 bg-gradient-to-br from-tone-indigo-border to-surface-stronger"
            aria-hidden="true"
          ></div>
        }

        <!-- Always-on dark gradient so the title reads in any theme regardless
             of the underlying image. Uses the scrim token (pure black) which is
             intentionally theme-invariant. -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/40 to-scrim/10"
          aria-hidden="true"
        ></div>

        @if (draft()) {
          <span class="absolute left-2 top-2 z-20"><app-tag tone="amber">{{ t('field.draftBadge') }}</app-tag></span>
        }

        <div appContentLang class="absolute inset-x-3 bottom-2 z-10 flex flex-col gap-0.5">
          @if (formattedDate(); as d) {
            <p class="m-0 text-[10px] font-medium uppercase tracking-wider text-scrim-foreground/85 drop-shadow">{{ d }}</p>
          }
          <h3 class="m-0 line-clamp-2 text-sm font-semibold text-scrim-foreground drop-shadow">{{ title() }}</h3>
          @if (plotlineChips().length > 0) {
            <ul class="m-0 mt-1 flex list-none flex-wrap gap-1 p-0">
              @for (p of plotlineChips(); track p.id) {
                <li>
                  <span
                    class="inline-block rounded-full border px-1.5 py-px text-[9px] font-medium text-scrim-foreground"
                    [style.borderColor]="p.color ?? 'var(--color-scrim-foreground)'"
                  >{{ p.label }}</span>
                </li>
              }
            </ul>
          }
        </div>

        @if (storyLink(); as link) {
          <a
            [routerLink]="link"
            class="absolute inset-0 z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ring"
            [attr.aria-label]="t('tooltip.playStory', { title: title() })"
          ></a>
        }
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineTileComponent {
  readonly card = input.required<TimelineCard>();
  readonly accentColor = input<string | null>(null);

  private readonly calendar = inject(CalendarService);
  private readonly media = inject(MediaAssetsService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  protected readonly title = computed(() => {
    const c = this.card();
    if (c.kind === 'story') {
      return c.story?.title || this.transloco.translate('catalog.field.untitled');
    }
    return c.event?.name ?? '';
  });

  protected readonly coverAssetId = computed(() => {
    const c = this.card();
    return c.kind === 'story' ? c.story?.coverAssetId : c.event?.coverAssetId;
  });

  protected readonly thumbUrl = computed(() => this.media.thumbUrlFor(this.coverAssetId()));
  protected readonly fullUrl = computed(() => this.media.urlFor(this.coverAssetId()));
  protected readonly blurDataUrl = computed(() => this.media.blurDataUrlFor(this.coverAssetId()));

  protected readonly blurBgImage = computed(() => {
    const u = this.blurDataUrl();
    return u ? `url(${u})` : null;
  });

  // When the lane itself carries a plotline color, suppress per-tile chips —
  // the lane border already conveys the plotline. Mixed-plotline cards in the
  // default lane show their chips inline.
  protected readonly plotlineChips = computed(() =>
    this.accentColor() ? [] : this.card().plotlines,
  );
  protected readonly draft = computed(() => this.card().story?.draft ?? false);

  protected readonly storyLink = computed<readonly [string, string] | null>(() => {
    const c = this.card();
    return c.kind === 'story' && c.story ? ['/play', c.story.id] : null;
  });

  protected readonly formattedDate = computed(() => {
    const c = this.card();
    if (!c.dated) return '';
    const d = c.date;
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
      weekdayName: this.calendar.weekdayLookup(d),
    });
  });

  constructor() {
    afterNextRender(() => this.setupPrefetch());
  }

  // Fires a `<link rel="prefetch">` for the full-res cover once the tile is
  // ≥50% visible, but only for stories — events don't have a navigation target
  // that would consume the full image. No-op if the browser lacks the API,
  // we're prerendering, or the thumb URL is the same as the full URL (no
  // separate variant exists for legacy assets).
  private setupPrefetch(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;
    if (!this.storyLink()) return;
    const full = this.fullUrl();
    if (!full || full === this.thumbUrl()) return;
    const el = this.root()?.nativeElement;
    if (!el) return;
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired) return;
        for (const entry of entries) {
          if (entry.intersectionRatio >= PREFETCH_VISIBLE_THRESHOLD) {
            fired = true;
            prefetch(full);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: [0, PREFETCH_VISIBLE_THRESHOLD, 1] },
    );
    io.observe(el);
    this.destroyRef.onDestroy(() => io.disconnect());
  }
}

// One `<link rel="prefetch">` per URL — repeated calls are idempotent. We
// keep the inserted links so we don't add duplicates if multiple tiles share
// the same cover (rare but possible).
const prefetched = new Set<string>();
function prefetch(url: string): void {
  if (prefetched.has(url)) return;
  prefetched.add(url);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = url;
  document.head.appendChild(link);
}
