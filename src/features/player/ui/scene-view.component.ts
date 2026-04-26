import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-scene-view',
  template: `
    <article
      class="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      @if (background(); as bg) {
        <img
          [src]="bg"
          alt=""
          class="aspect-video w-full object-cover"
          loading="lazy"
        />
      }

      @if (characters().length > 0) {
        <ul class="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
          @for (src of characters(); track src) {
            <li>
              <img
                [src]="src"
                alt=""
                class="size-16 rounded-full border border-slate-200 object-cover"
                loading="lazy"
              />
            </li>
          }
        </ul>
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
  readonly characters = input<string[]>([]);
  readonly audio = input<string | undefined>();

  protected readonly audioLabel = computed(() => {
    const s = this.speaker();
    return s ? `Audio for ${s}` : 'Scene audio';
  });
}
