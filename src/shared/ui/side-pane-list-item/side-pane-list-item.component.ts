import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EntityKind } from '@shared/models';
import { EntityKindIconComponent } from '../entity-kind-icon';
import { LazyThumbComponent } from '../lazy-thumb';
import { WorldIconComponent } from '../world-icon';

export interface ListPaneItem {
  id: string;
  label: string;
  secondary?: string;
  /**
   * Asset ID to lazy-resolve via `AssetThumbResolver`. Renders a small
   * skeleton until the thumb fetches. Preferred over `thumbnailUrl`.
   */
  coverAssetId?: string;
  /** Legacy direct URL; populated when callers haven't migrated yet. */
  thumbnailUrl?: string;
  /**
   * Per-item kind glyph for cover-less rows. Lets a mixed list (e.g. the
   * Explore stream) carry a different icon per row; uniform lists pass a
   * list-level `kind` instead.
   */
  kind?: EntityKind;
  badge?: { text: string; tone?: 'amber' | 'slate' };
}

@Component({
  selector: 'app-side-pane-list-item',
  imports: [LazyThumbComponent, EntityKindIconComponent, WorldIconComponent],
  template: `
    <button
      type="button"
      role="option"
      class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      [class.bg-accent-soft]="selected()"
      [class.text-accent-soft-foreground]="selected()"
      [attr.aria-selected]="selected()"
      (click)="select.emit()"
    >
      @if (item().coverAssetId; as assetId) {
        <app-lazy-thumb class="size-10 shrink-0 rounded" [assetId]="assetId" />
      } @else if (item().thumbnailUrl; as url) {
        <img [src]="url" alt="" class="size-10 shrink-0 rounded object-cover" />
      } @else if (resolvedKind(); as k) {
        <span
          class="grid size-10 shrink-0 place-items-center rounded bg-surface-muted text-foreground-faint"
          aria-hidden="true"
        >
          <app-entity-kind-icon class="size-5" [kind]="k" />
        </span>
      } @else if (worldPlaceholder()) {
        <span
          class="grid size-10 shrink-0 place-items-center rounded bg-surface-muted text-foreground-faint"
          aria-hidden="true"
        >
          <app-world-icon class="size-5" />
        </span>
      }

      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate font-medium text-foreground">{{ item().label }}</span>
        @if (item().secondary; as secondary) {
          <span class="truncate text-xs text-foreground-faint">{{ secondary }}</span>
        }
      </span>

      @if (item().badge; as badge) {
        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
          [class.bg-warning]="badge.tone !== 'slate'"
          [class.text-warning-foreground]="badge.tone !== 'slate'"
          [class.bg-surface-muted]="badge.tone === 'slate'"
          [class.text-foreground-muted]="badge.tone === 'slate'"
        >{{ badge.text }}</span>
      }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePaneListItemComponent {
  readonly item = input.required<ListPaneItem>();
  // Fallback glyph for uniform lists; overridden by a per-item `kind`.
  readonly kind = input<EntityKind | undefined>(undefined);
  readonly selected = input<boolean>(false);
  readonly worldPlaceholder = input<boolean>(false);

  readonly select = output<void>();

  protected readonly resolvedKind = computed(() => this.item().kind ?? this.kind());
}
