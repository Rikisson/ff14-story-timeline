import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AssetThumbResolver } from '@shared/data-access';

@Component({
  selector: 'app-detail-card',
  imports: [NgOptimizedImage],
  host: { class: 'block h-full @container' },
  template: `
    <article
      class="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm @4xl:flex-row"
    >
      @if (coverUrl(); as u) {
        <div
          class="relative h-56 w-full shrink-0 overflow-hidden bg-surface-muted @4xl:order-last @4xl:h-full @4xl:w-[var(--detail-cover-width)]"
        >
          <img [ngSrc]="u" alt="" fill priority class="object-cover @4xl:object-[45%_center]" />
          <div
            class="cover-seam absolute inset-y-0 left-0 hidden w-[15%] @4xl:block"
            aria-hidden="true"
          ></div>
        </div>
      }
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <div class="flex w-full max-w-prose flex-col gap-3">
          <ng-content />
        </div>
      </div>
    </article>
  `,
  styles: `
    .cover-seam {
      background: linear-gradient(
        to right,
        rgb(from var(--color-surface) r g b / 1) 0%,
        rgb(from var(--color-surface) r g b / 0.98) 12%,
        rgb(from var(--color-surface) r g b / 0.89) 30%,
        rgb(from var(--color-surface) r g b / 0.69) 50%,
        rgb(from var(--color-surface) r g b / 0.42) 68%,
        rgb(from var(--color-surface) r g b / 0.2) 80%,
        rgb(from var(--color-surface) r g b / 0.085) 87%,
        rgb(from var(--color-surface) r g b / 0.025) 93%,
        rgb(from var(--color-surface) r g b / 0) 100%
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailCardComponent {
  readonly coverAssetId = input<string | undefined>(undefined);

  private readonly assets = inject(AssetThumbResolver);

  protected readonly coverUrl = computed(
    () => this.assets.resolve(this.coverAssetId())()?.url,
  );
}
