import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-side-pane',
  host: { class: 'block min-h-0' },
  template: `
    <aside
      class="flex h-full min-h-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3"
      [attr.aria-label]="ariaLabel() || null"
    >
      <ng-content />
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePaneComponent {
  readonly ariaLabel = input<string>('');
}
