import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { AssetPickerComponent, MediaAssetsService } from '@features/media';
import { Scene } from '@features/stories';
import { GhostButtonComponent, SecondaryButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-scene-assets-panel',
  imports: [
    AssetPickerComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    NgOptimizedImage,
  ],
  template: `
    <section class="flex flex-col gap-4">
      <h4 class="m-0 text-sm font-semibold text-slate-700">Assets</h4>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Background
        </label>
        @if (backgroundUrl(); as bg) {
          <div class="relative aspect-video w-full overflow-hidden rounded border border-slate-200">
            <img [ngSrc]="bg" alt="Scene background" fill class="object-cover" />
          </div>
          <div class="flex gap-2">
            <button uiSecondary type="button" (click)="bgPicker.open()">Replace</button>
            <button uiGhost type="button" (click)="clearBackground()">Remove</button>
          </div>
        } @else {
          <button uiSecondary type="button" (click)="bgPicker.open()">
            Pick background
          </button>
        }
        <app-asset-picker
          #bgPicker
          kind="background"
          title="Pick a scene background"
          [currentSelection]="backgroundSelection()"
          (picked)="onBackgroundPicked($event)"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium uppercase tracking-wide text-slate-500">Audio</label>
        @if (audioUrl(); as a) {
          <audio class="w-full" controls preload="none" [src]="a"></audio>
          <div class="flex gap-2">
            <button uiSecondary type="button" (click)="audioPicker.open()">Replace</button>
            <button uiGhost type="button" (click)="clearAudio()">Remove</button>
          </div>
        } @else {
          <button uiSecondary type="button" (click)="audioPicker.open()">
            Pick audio
          </button>
        }
        <app-asset-picker
          #audioPicker
          kind="ambient"
          title="Pick scene audio"
          [currentSelection]="audioSelection()"
          (picked)="onAudioPicked($event)"
        />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneAssetsPanelComponent {
  private readonly media = inject(MediaAssetsService);

  readonly backgroundAssetId = input<string | undefined>();
  readonly audioAssetId = input<string | undefined>();

  readonly update = output<Partial<Scene>>();

  protected readonly backgroundUrl = computed(() => this.media.urlFor(this.backgroundAssetId()));
  protected readonly audioUrl = computed(() => this.media.urlFor(this.audioAssetId()));

  protected readonly backgroundSelection = computed(() => {
    const id = this.backgroundAssetId();
    return id ? [id] : [];
  });
  protected readonly audioSelection = computed(() => {
    const id = this.audioAssetId();
    return id ? [id] : [];
  });

  protected onBackgroundPicked(ids: string[]): void {
    this.update.emit({ backgroundAssetId: ids[0] });
  }

  protected onAudioPicked(ids: string[]): void {
    this.update.emit({ audioAssetId: ids[0] });
  }

  protected clearBackground(): void {
    this.update.emit({ backgroundAssetId: undefined });
  }

  protected clearAudio(): void {
    this.update.emit({ audioAssetId: undefined });
  }
}
