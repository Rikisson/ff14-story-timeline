import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReteCanvasComponent } from '../ui/rete-canvas.component';

@Component({
  selector: 'app-editor-page',
  imports: [ReteCanvasComponent],
  template: `
    <h2>Editor</h2>
    <p>Story id: <code>{{ id() }}</code></p>
    <app-rete-canvas />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPage {
  readonly id = input.required<string>();
}
