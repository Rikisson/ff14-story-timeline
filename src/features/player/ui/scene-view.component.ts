import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-scene-view',
  imports: [NgOptimizedImage],
  template: `
    <article
      class="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      @if (background(); as bg) {
        <div class="relative aspect-video w-full">
          <img [ngSrc]="bg" alt="" fill class="object-cover" />
        </div>
      }

      <div class="flex flex-col gap-2 px-5 py-4">
        @if (speaker(); as s) {
          <p class="m-0 text-sm font-semibold text-slate-700">{{ s }}</p>
        }
        <p class="m-0 whitespace-pre-wrap text-base leading-relaxed text-slate-900">
          {{ text() }}
        </p>
      </div>

      @if (audio(); as a) {
        <audio
          class="w-full"
          controls
          preload="auto"
          [src]="a"
          [attr.aria-label]="audioLabel()"
        ></audio>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneViewComponent {
  readonly text = input.required<string>();
  readonly speaker = input<string | undefined>();
  readonly background = input<string | undefined>();
  readonly audio = input<string | undefined>();

  protected readonly audioLabel = computed(() => {
    const s = this.speaker();
    return s ? `Audio for ${s}` : 'Scene audio';
  });
}
