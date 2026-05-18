import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AssetThumbResolver, EntityResolverCache } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { PrimaryButtonComponent } from '@shared/ui';
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
 * Reader end-of-content surface. Renders below the scene-view when a
 * story end-scene or an event has no further reading to offer. If the
 * author wired `nextRefs`, up to three continuation cards link forward;
 * Restart + Back-to-catalog are always available.
 *
 * The component owns its own resolver lookups so the parent only has to
 * hand it the refs and listen for `restart`.
 */
@Component({
  selector: 'app-end-of-content',
  host: { class: 'block' },
  imports: [RouterLink, PrimaryButtonComponent, TranslocoDirective],
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
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
        <p class="m-0 text-sm italic text-foreground-subtle">{{ t('message.end') }}</p>

        @if (cards().length > 0) {
          <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3" role="list">
            @for (card of cards(); track card.kind + ':' + card.id) {
              <li>
                <a
                  [routerLink]="card.link"
                  class="group block overflow-hidden rounded-lg border border-border bg-surface transition hover:border-accent-ring hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
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

        <div class="flex flex-wrap items-center gap-3">
          @if (showRestart()) {
            <button uiPrimary type="button" (click)="restart.emit()">{{ t('action.restart') }}</button>
          }
          <a routerLink="/library" class="text-sm text-accent hover:underline">
            {{ t('action.backToCatalog') }}
          </a>
        </div>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EndOfContentComponent {
  readonly nextRefs = input<EntityRef<'story' | 'event'>[] | undefined>(undefined);
  // Events have no "start" to restart to; the host opts out by passing
  // `false` and the button is omitted entirely.
  readonly showRestart = input<boolean>(true);
  readonly restart = output<void>();

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
