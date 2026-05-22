import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AssetThumbResolver } from '@shared/data-access';

@Component({
  selector: 'app-detail-card',
  imports: [NgOptimizedImage],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      @if (coverUrl(); as u) {
        <div class="relative h-56 w-full shrink-0 overflow-hidden bg-surface-muted">
          <img [ngSrc]="u" alt="" fill priority class="object-cover" />
        </div>
      }
      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        <ng-content />
      </div>
    </article>
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
