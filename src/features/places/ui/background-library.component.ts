import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AssetPickerComponent } from '@features/media';
import { AssetThumbResolver } from '@shared/data-access';
import { DangerButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { PlacesService } from '../data-access/places.service';
import placeEn from '../i18n/en.json';
import placeUk from '../i18n/uk.json';

interface ResolvedBackground {
  id: string;
  label: string;
  url: string;
}

/**
 * Place backgrounds library — the authoring surface for `Place.backgrounds[]`.
 * Mirrors `app-character-sprite-library`: a managed asset-ID array edited live
 * through a dedicated service method, rendered as a sibling of the place form
 * in edit mode. Unlike sprites there is no "default" — nothing consumes
 * `backgrounds[0]`; the scene editor picks any entry explicitly.
 */
@Component({
  selector: 'app-place-background-library',
  imports: [
    NgOptimizedImage,
    AssetPickerComponent,
    DangerButtonComponent,
    SecondaryButtonComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'place',
      loader: {
        en: () => Promise.resolve(placeEn),
        uk: () => Promise.resolve(placeUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'place'">
      <ng-container *transloco="let g; prefix: 'general'">
        <section class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <header class="flex items-center justify-between">
            <h4 class="m-0 text-sm font-semibold text-foreground">{{ t('field.backgroundsHeader') }}</h4>
          </header>

          @if (error(); as e) {
            <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
          }

          @if (resolved().length === 0) {
            <p class="m-0 text-sm italic text-foreground-faint">{{ t('empty.backgroundsList') }}</p>
          } @else {
            <ul class="flex flex-col gap-2">
              @for (b of resolved(); track b.id) {
                <li class="flex items-center gap-2 rounded-md border border-border p-2">
                  <img
                    [ngSrc]="b.url"
                    alt=""
                    width="64"
                    height="36"
                    class="h-9 w-16 rounded object-cover"
                  />
                  <span class="flex-1 truncate text-sm text-foreground">{{ b.label }}</span>
                  <button uiDanger type="button" (click)="remove(b.id)">{{ g('action.remove') }}</button>
                </li>
              }
            </ul>
          }

          <div>
            <button
              uiSecondary
              type="button"
              [loading]="busy()"
              (click)="picker.open()"
            >
              {{ t('action.addBackgroundFromLibrary') }}
            </button>
          </div>

          <app-asset-picker
            #picker
            kind="background"
            [title]="t('tooltip.backgroundPickerTitle')"
            [multiSelect]="true"
            [currentSelection]="backgrounds()"
            (picked)="onPicked($event)"
          />
        </section>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackgroundLibraryComponent {
  readonly placeId = input.required<string>();
  readonly backgrounds = input<string[]>([]);

  private readonly assets = inject(AssetThumbResolver);
  private readonly service = inject(PlacesService);
  private readonly transloco = inject(TranslocoService);
  protected readonly picker = viewChild.required(AssetPickerComponent);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly resolvedThumbs = this.assets.resolveMany(this.backgrounds);
  protected readonly resolved = computed<ResolvedBackground[]>(() => {
    const map = this.resolvedThumbs();
    const out: ResolvedBackground[] = [];
    for (const id of this.backgrounds()) {
      const thumb = map.get(id);
      if (thumb) {
        out.push({ id: thumb.id, label: thumb.label ?? id, url: thumb.url });
      }
    }
    return out;
  });

  protected async onPicked(ids: string[]): Promise<void> {
    await this.run(() => this.service.updateBackgrounds(this.placeId(), ids));
  }

  protected async remove(id: string): Promise<void> {
    if (!confirm(this.transloco.translate('place.message.removeBackgroundConfirm'))) return;
    const next = this.backgrounds().filter((x) => x !== id);
    await this.run(() => this.service.updateBackgrounds(this.placeId(), next));
  }

  private async run(work: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await work();
    } catch (err) {
      this.error.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }
}
