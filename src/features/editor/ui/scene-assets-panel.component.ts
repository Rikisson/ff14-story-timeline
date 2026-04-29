import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Scene, StoryAssetsService } from '@features/stories';
import { GhostButtonComponent, SecondaryButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-scene-assets-panel',
  imports: [GhostButtonComponent, SecondaryButtonComponent, NgOptimizedImage],
  template: `
    <section class="flex flex-col gap-4">
      <h4 class="m-0 text-sm font-semibold text-slate-700">Assets</h4>

      @if (uploadError(); as e) {
        <p class="m-0 text-sm text-red-700">{{ e }}</p>
      }

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Background
        </label>
        @if (background(); as bg) {
          <div class="relative aspect-video w-full overflow-hidden rounded border border-slate-200">
            <img [ngSrc]="bg" alt="Scene background" fill class="object-cover" />
          </div>
          <div class="flex gap-2">
            <button
              uiSecondary
              type="button"
              [loading]="busyBackground()"
              (click)="bgInput.click()"
            >
              Replace
            </button>
            <button uiGhost type="button" (click)="clearBackground()">Remove</button>
          </div>
        } @else {
          <button
            uiSecondary
            type="button"
            [loading]="busyBackground()"
            (click)="bgInput.click()"
          >
            Upload background
          </button>
        }
        <input
          #bgInput
          type="file"
          accept="image/*"
          class="hidden"
          (change)="onPick($event, 'background')"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium uppercase tracking-wide text-slate-500">Audio</label>
        @if (audio(); as a) {
          <audio class="w-full" controls preload="none" [src]="a"></audio>
          <div class="flex gap-2">
            <button
              uiSecondary
              type="button"
              [loading]="busyAudio()"
              (click)="audioInput.click()"
            >
              Replace
            </button>
            <button uiGhost type="button" (click)="clearAudio()">Remove</button>
          </div>
        } @else {
          <button
            uiSecondary
            type="button"
            [loading]="busyAudio()"
            (click)="audioInput.click()"
          >
            Upload audio
          </button>
        }
        <input
          #audioInput
          type="file"
          accept="audio/*"
          class="hidden"
          (change)="onPick($event, 'audio')"
        />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneAssetsPanelComponent {
  private readonly assets = inject(StoryAssetsService);

  readonly storyId = input.required<string>();
  readonly sceneId = input.required<string>();
  readonly background = input<string | undefined>();
  readonly audio = input<string | undefined>();

  readonly update = output<Partial<Scene>>();

  protected readonly busyBackground = signal(false);
  protected readonly busyAudio = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  protected async onPick(event: Event, kind: 'background' | 'audio'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const busy = kind === 'background' ? this.busyBackground : this.busyAudio;
    busy.set(true);
    this.uploadError.set(null);
    try {
      const url = await this.assets.upload(this.storyId(), this.sceneId(), kind, file);
      if (kind === 'background') this.update.emit({ background: url });
      else this.update.emit({ audio: url });
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      busy.set(false);
    }
  }

  protected clearBackground(): void {
    this.update.emit({ background: undefined });
  }

  protected clearAudio(): void {
    this.update.emit({ audio: undefined });
  }
}
