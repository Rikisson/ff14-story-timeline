import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-scene-view',
  template: `
    @if (speaker(); as s) {
      <p class="speaker">{{ s }}</p>
    }
    <p class="text">{{ text() }}</p>
  `,
  styles: `
    :host {
      display: block;
      max-width: 640px;
      margin: 0 0 1.5rem;
      padding: 1rem 1.25rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background: #fff;
    }
    .speaker {
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: #374151;
    }
    .text {
      margin: 0;
      line-height: 1.6;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneViewComponent {
  readonly text = input.required<string>();
  readonly speaker = input<string | undefined>();
}
