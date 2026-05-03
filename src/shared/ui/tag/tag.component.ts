import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type TagTone = 'neutral' | 'amber' | 'emerald' | 'sky' | 'indigo' | 'rose';

const TONE_CLASS: Record<TagTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  rose: 'bg-rose-100 text-rose-700',
};

@Component({
  selector: 'app-tag',
  template: `
    <span
      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      [class]="toneClass()"
    >
      <ng-content />
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagComponent {
  readonly tone = input<TagTone>('neutral');

  protected readonly toneClass = computed(() => TONE_CLASS[this.tone()]);
}
