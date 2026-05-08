import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  GhostButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { MediaAssetsService } from '../data-access/media-assets.service';
import { AssetPickerComponent } from './asset-picker.component';

@Component({
  selector: 'app-cover-slot',
  imports: [
    NgOptimizedImage,
    AssetPickerComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
  ],
  template: `
    <div class="flex flex-col gap-2">
      @if (label(); as l) {
        <span class="text-sm font-medium text-slate-700">{{ l }}</span>
      }
      @if (url(); as u) {
        <div
          class="relative aspect-video w-full overflow-hidden rounded border border-slate-200 bg-slate-100"
        >
          <img [ngSrc]="u" alt="" fill class="object-cover" />
        </div>
        <div class="flex gap-2">
          <button uiSecondary type="button" (click)="picker.open()">Replace</button>
          <button uiGhost type="button" (click)="clear()">Remove</button>
        </div>
      } @else {
        <button uiSecondary type="button" (click)="picker.open()">Pick cover</button>
      }
      <app-asset-picker
        #picker
        kind="cover"
        title="Pick a cover image"
        [currentSelection]="selection()"
        (picked)="onPicked($event)"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverSlotComponent {
  readonly assetId = input<string | undefined>();
  readonly label = input<string>('');
  readonly picked = output<string | undefined>();

  private readonly media = inject(MediaAssetsService);

  protected readonly url = computed(() => this.media.urlFor(this.assetId()));
  protected readonly selection = computed(() => {
    const id = this.assetId();
    return id ? [id] : [];
  });

  protected onPicked(ids: string[]): void {
    this.picked.emit(ids[0]);
  }

  protected clear(): void {
    this.picked.emit(undefined);
  }
}
