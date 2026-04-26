import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-player-page',
  template: `
    <h2>Play story</h2>
    <p>Story id: <code>{{ id() }}</code></p>
    <p>Player UI will live here.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerPage {
  readonly id = input.required<string>();
}
