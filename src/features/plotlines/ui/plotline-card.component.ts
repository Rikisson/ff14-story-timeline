import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';
import { Plotline, PlotlineStatus } from '../data-access/plotline.types';

const STATUS_LABEL: Record<PlotlineStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  resolved: 'Resolved',
};

const STATUS_CLASS: Record<PlotlineStatus, string> = {
  planned: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-50 text-emerald-700',
  resolved: 'bg-indigo-50 text-indigo-700',
};

@Component({
  selector: 'app-plotline-card',
  imports: [GhostButtonComponent, DangerButtonComponent],
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
        @if (statusInfo(); as s) {
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium"
            [class]="s.cls"
          >{{ s.label }}</span>
        }
      </div>
      @if (plotline().summary; as s) {
        <p class="m-0 line-clamp-3 text-sm text-slate-700">{{ s }}</p>
      }
      @if (canEdit()) {
        <div class="mt-auto flex gap-2 pt-2">
          <button uiGhost type="button" (click)="edit.emit()">Edit</button>
          <button uiDanger type="button" (click)="remove.emit()">Delete</button>
        </div>
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
    return { label: STATUS_LABEL[s], cls: STATUS_CLASS[s] };
  });
}
