import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="m-0 text-sm text-slate-600">{{ subtitle() }}</p>
        }
      </div>
      <ng-content />
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
