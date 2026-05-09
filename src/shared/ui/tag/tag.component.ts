import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type TagTone = 'neutral' | 'amber' | 'emerald' | 'sky' | 'indigo' | 'rose';

const TONE_CLASS: Record<TagTone, string> = {
  neutral: 'bg-surface-muted text-foreground-muted',
  amber: 'bg-tone-amber text-tone-amber-foreground',
  emerald: 'bg-tone-emerald text-tone-emerald-foreground',
  sky: 'bg-tone-sky text-tone-sky-foreground',
  indigo: 'bg-tone-indigo text-tone-indigo-foreground',
  rose: 'bg-tone-rose text-tone-rose-foreground',
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
