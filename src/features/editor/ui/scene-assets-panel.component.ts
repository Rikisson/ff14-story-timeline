import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Scene, StoryAssetsService } from '@features/stories';
import { GhostButtonComponent, SecondaryButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-scene-assets-panel',
  imports: [GhostButtonComponent, SecondaryButtonComponent],
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
          <img
            [src]="bg"
            alt="Scene background"
            class="aspect-video w-full rounded border border-slate-200 object-cover"
          />
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
        <label class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Characters
        </label>
        @if (characters().length > 0) {
          <ul class="flex flex-wrap gap-2">
            @for (src of characters(); track $index) {
              <li class="relative">
                <img
                  [src]="src"
                  alt="Character portrait"
                  class="size-16 rounded-full border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-xs text-white hover:bg-red-700"
                  [attr.aria-label]="'Remove character ' + ($index + 1)"
                  (click)="removeCharacter($index)"
                >
                  ×
                </button>
              </li>
            }
          </ul>
        }
        <button
          uiSecondary
          type="button"
          [loading]="busyCharacter()"
          (click)="charInput.click()"
        >
          + Add character
        </button>
        <input
          #charInput
          type="file"
          accept="image/*"
          class="hidden"
          (change)="onPick($event, 'character')"
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
  readonly characters = input<string[]>([]);
  readonly audio = input<string | undefined>();

  readonly update = output<Partial<Scene>>();

  protected readonly busyBackground = signal(false);
  protected readonly busyCharacter = signal(false);
  protected readonly busyAudio = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  protected async onPick(event: Event, kind: 'background' | 'character' | 'audio'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const busy = this.busyFor(kind);
    busy.set(true);
    this.uploadError.set(null);
    try {
      const url = await this.assets.upload(this.storyId(), this.sceneId(), kind, file);
      if (kind === 'background') this.update.emit({ background: url });
      else if (kind === 'audio') this.update.emit({ audio: url });
      else this.update.emit({ characters: [...this.characters(), url] });
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

  protected removeCharacter(index: number): void {
    const next = this.characters().filter((_, i) => i !== index);
    this.update.emit({ characters: next });
  }

  private busyFor(kind: 'background' | 'character' | 'audio') {
    if (kind === 'background') return this.busyBackground;
    if (kind === 'audio') return this.busyAudio;
    return this.busyCharacter;
  }
}
