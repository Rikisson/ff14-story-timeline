import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AssetThumbResolver, EntityResolverCache } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';

interface ContinuationCard {
  kind: 'story' | 'event';
  id: string;
  label: string;
  coverUrl: string | undefined;
  link: readonly [string, string];
}

/**
 * End-of-content continuation surface. Shows the author-wired `nextRefs`
 * cards (up to three) so readers can flow into the next piece. Renders
 * nothing when there are no resolved continuations — Restart and
 * Back-to-catalog live in the reader chrome and don't need a second copy.
 */
@Component({
  selector: 'app-end-of-content',
  host: { class: 'block' },
  imports: [RouterLink, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'reader',
      loader: {
        en: () => Promise.resolve(readerEn),
        uk: () => Promise.resolve(readerUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'reader'">
      @if (cards().length > 0) {
        <ul class="mx-auto grid w-full max-w-7xl grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 md:grid-cols-3" role="list">
          @for (card of cards(); track card.kind + ':' + card.id) {
            <li>
              <a
                [routerLink]="card.link"
                class="group block overflow-hidden rounded-lg border border-border bg-surface shadow-lg transition hover:border-accent-ring hover:shadow-xl focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                @if (card.coverUrl; as url) {
                  <img [src]="url" alt="" class="aspect-video w-full object-cover" />
                } @else {
                  <div class="aspect-video w-full bg-surface-muted"></div>
                }
                <div class="flex items-center justify-between gap-2 px-3 py-2">
                  <span class="text-sm font-medium text-foreground">{{ card.label }}</span>
                  <span class="text-xs text-accent transition group-hover:translate-x-0.5" aria-hidden="true">→</span>
                </div>
                <span class="sr-only">{{ t('action.continueReading') }}</span>
              </a>
            </li>
          }
        </ul>
      }
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndOfContentComponent {
  readonly nextRefs = input<EntityRef<'story' | 'event'>[] | undefined>(undefined);

  private readonly assets = inject(AssetThumbResolver);
  private readonly resolver = inject(EntityResolverCache);

  // Cap at three continuation cards per the design — more would crowd
  // the row at typical viewport widths and dilute focus.
  private readonly refs = computed<EntityRef<'story' | 'event'>[]>(() =>
    (this.nextRefs() ?? []).slice(0, 3),
  );
  private readonly resolvedRefs = this.resolver.resolveMany(this.refs);

  protected readonly cards = computed<ContinuationCard[]>(() => {
    const resolved = this.resolvedRefs();
    const out: ContinuationCard[] = [];
    for (const r of this.refs()) {
      const row = resolved.get(`${r.kind}:${r.id}`);
      if (!row) continue;
      out.push({
        kind: r.kind,
        id: r.id,
        label: row.label,
        coverUrl: this.assets.resolve(row.coverAssetId)()?.url,
        link: [r.kind === 'story' ? '/reader/story' : '/reader/event', r.id],
      });
    }
    return out;
  });
}
