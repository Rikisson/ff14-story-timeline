import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type TagTone = 'neutral' | 'amber' | 'emerald' | 'sky' | 'indigo' | 'rose';

const TONE_CLASS: Record<TagTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
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
