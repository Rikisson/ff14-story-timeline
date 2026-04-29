import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InlineRefOption, InlineRefTextComponent } from '@shared/ui';

export interface StagedView {
  id: string;
  name: string;
  position: string;
  order?: number;
  portraitUrl?: string;
  isSpeaker: boolean;
}

const POSITION_SLOTS = ['left', 'center', 'right'] as const;
type PositionSlot = (typeof POSITION_SLOTS)[number];

@Component({
  selector: 'app-scene-view',
  imports: [NgOptimizedImage, InlineRefTextComponent],
  template: `
    <article
      class="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
    >
      @if (background(); as bg) {
        <div class="relative aspect-video w-full">
          <img [ngSrc]="bg" alt="" fill class="object-cover" />
        </div>
      }

      @if (staged().length > 0) {
        <div class="grid grid-cols-3 gap-2 border-b border-slate-200 px-4 py-3">
          @for (slot of slots; track slot) {
            <div class="flex flex-wrap items-end justify-center gap-2">
              @for (s of stagedFor(slot); track s.id) {
                <figure
                  class="m-0 flex flex-col items-center gap-1 transition-opacity"
                  [class.opacity-40]="!s.isSpeaker"
                >
                  @if (s.portraitUrl; as url) {
                    <img
                      [ngSrc]="url"
                      [alt]="s.name"
                      width="120"
                      height="120"
                      class="size-24 rounded-md border border-slate-200 object-cover"
                    />
                  } @else {
                    <div
                      class="flex size-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
                    >
                      no portrait
                    </div>
                  }
                  <figcaption class="text-xs font-medium text-slate-700">
                    {{ s.name }}
                  </figcaption>
                </figure>
              }
              @for (s of stagedOther(slot); track s.id) {
                <figure
                  class="m-0 flex flex-col items-center gap-1 transition-opacity"
                  [class.opacity-40]="!s.isSpeaker"
                  [title]="'Position: ' + s.position"
                >
                  @if (s.portraitUrl; as url) {
                    <img
                      [ngSrc]="url"
                      [alt]="s.name"
                      width="120"
                      height="120"
                      class="size-24 rounded-md border border-slate-200 object-cover"
                    />
                  } @else {
                    <div
                      class="flex size-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
                    >
                      no portrait
                    </div>
                  }
                  <figcaption class="text-xs font-medium text-slate-700">
                    {{ s.name }}
                  </figcaption>
                </figure>
              }
            </div>
          }
        </div>
      }

      <div class="flex flex-col gap-2 px-5 py-4">
        @if (speaker(); as s) {
          <p class="m-0 text-sm font-semibold text-slate-700">{{ s }}</p>
        }
        <p class="m-0 whitespace-pre-wrap text-base leading-relaxed text-slate-900">
          <app-inline-ref-text [text]="text()" [options]="inlineRefOptions()" />
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
  readonly staged = input<StagedView[]>([]);
  readonly inlineRefOptions = input<InlineRefOption[]>([]);

  protected readonly slots = POSITION_SLOTS;

  protected readonly audioLabel = computed(() => {
    const s = this.speaker();
    return s ? `Audio for ${s}` : 'Scene audio';
  });

  protected stagedFor(slot: PositionSlot): StagedView[] {
    return this.staged()
      .filter((s) => s.position === slot)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  protected stagedOther(slot: PositionSlot): StagedView[] {
    if (slot !== 'center') return [];
    const known = new Set<string>(POSITION_SLOTS);
    return this.staged()
      .filter((s) => !known.has(s.position))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}
