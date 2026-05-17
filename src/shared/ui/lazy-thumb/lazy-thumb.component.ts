import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { AssetThumbResolver } from '@shared/data-access';

/**
 * Fixed-size lazy thumb for list / card / chip surfaces. Reserves its
 * box via `width` + `height` (consumer-supplied class wraps the host)
 * so no layout shift occurs when the URL fades in. Per
 * `docs/media-rules.md` *Loading*: resolves through `AssetThumbResolver`,
 * renders a skeleton placeholder during the fetch, then fades in
 * `thumbUrl ?? url`. When the resolver reports the asset doesn't exist
 * (deleted, never created), the host's `bg-surface-muted` shows as a
 * stable empty box — the pulse stops.
 *
 * The host element controls the dimensions — pass a sizing class
 * (e.g. `size-10`) on the component selector. The internal img is
 * absolutely-positioned, so it fills whatever box the host defines.
 */
@Component({
  selector: 'app-lazy-thumb',
  host: { class: 'relative inline-block overflow-hidden bg-surface-muted' },
  template: `
    @if (assetId()) {
      @let t = thumb();
      @if (t) {
        <img
          [src]="t.thumbUrl ?? t.url"
          [alt]="alt()"
          class="absolute inset-0 h-full w-full object-cover animate-[fadeIn_180ms_ease-out]"
        />
      } @else if (t === undefined) {
        <span class="absolute inset-0 animate-pulse bg-surface-muted" aria-hidden="true"></span>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LazyThumbComponent {
  readonly assetId = input<string | undefined>(undefined);
  readonly alt = input<string>('');

  private readonly assets = inject(AssetThumbResolver);
  protected readonly thumb = computed(() => this.assets.resolve(this.assetId())());
}
