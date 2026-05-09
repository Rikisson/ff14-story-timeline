import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MediaAssetsService } from '@features/media';
import { DangerButtonComponent, GhostButtonComponent, TagComponent, TagTone } from '@shared/ui';
import { PLOTLINE_STATUS_LABEL, Plotline, PlotlineStatus } from '../data-access/plotline.types';

const STATUS_TONE: Record<PlotlineStatus, TagTone> = {
  planned: 'neutral',
  active: 'emerald',
  resolved: 'indigo',
};

@Component({
  selector: 'app-plotline-card',
  imports: [NgOptimizedImage, GhostButtonComponent, DangerButtonComponent, TagComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
    >
      @if (coverUrl(); as u) {
        <div class="relative aspect-video w-full bg-slate-100 dark:bg-slate-800">
          <img [ngSrc]="u" alt="" fill class="object-cover" />
        </div>
      }
      <div class="flex flex-1 flex-col gap-3 p-4">
        <div class="flex items-start gap-2">
          @if (plotline().color; as c) {
            <span
              class="mt-1 inline-block size-3 shrink-0 rounded-full border border-slate-200 dark:border-slate-700"
              [style.background-color]="c"
              aria-hidden="true"
            ></span>
          }
          <h3 class="m-0 flex-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{{ plotline().title }}</h3>
          <div class="flex shrink-0 items-center gap-2">
            @if (statusInfo(); as s) {
              <app-tag [tone]="s.tone">{{ s.label }}</app-tag>
            }
            @if (canEdit()) {
              <button uiGhost type="button" (click)="edit.emit()">Edit</button>
              <button uiDanger type="button" (click)="remove.emit()">Delete</button>
            }
          </div>
        </div>
        @if (plotline().description; as d) {
          <p class="m-0 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{{ d }}</p>
        }
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlotlineCardComponent {
  readonly plotline = input.required<Plotline>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly media = inject(MediaAssetsService);

  protected readonly statusInfo = computed(() => {
    const s = this.plotline().status;
    if (!s) return null;
    return { label: PLOTLINE_STATUS_LABEL[s], tone: STATUS_TONE[s] };
  });
  protected readonly coverUrl = computed(() => this.media.urlFor(this.plotline().coverAssetId));
}
