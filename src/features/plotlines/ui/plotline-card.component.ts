import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DangerButtonComponent, GhostButtonComponent, TagComponent, TagTone } from '@shared/ui';
import { Plotline, PlotlineStatus } from '../data-access/plotline.types';

const STATUS_LABEL: Record<PlotlineStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  resolved: 'Resolved',
};

const STATUS_TONE: Record<PlotlineStatus, TagTone> = {
  planned: 'neutral',
  active: 'emerald',
  resolved: 'indigo',
};

@Component({
  selector: 'app-plotline-card',
  imports: [GhostButtonComponent, DangerButtonComponent, TagComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex items-start gap-2">
        @if (plotline().color; as c) {
          <span
            class="mt-1 inline-block size-3 shrink-0 rounded-full border border-slate-200"
            [style.background-color]="c"
            aria-hidden="true"
          ></span>
        }
        <h3 class="m-0 flex-1 text-lg font-semibold text-slate-900">{{ plotline().title }}</h3>
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
      @if (plotline().summary; as s) {
        <p class="m-0 whitespace-pre-line text-sm text-slate-700">{{ s }}</p>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlotlineCardComponent {
  readonly plotline = input.required<Plotline>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  protected readonly statusInfo = computed(() => {
    const s = this.plotline().status;
    if (!s) return null;
    return { label: STATUS_LABEL[s], tone: STATUS_TONE[s] };
  });
}
