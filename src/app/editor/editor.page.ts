import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  inject,
  input,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-editor-page',
  template: `
    <h2>Editor</h2>
    <p>Story id: <code>{{ id() }}</code></p>
    <div #container class="rete-container"></div>
  `,
  styles: `
    .rete-container {
      width: 100%;
      height: 600px;
      border: 1px solid #ccc;
      background: #fafafa;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPage {
  readonly id = input.required<string>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly injector = inject(Injector);

  constructor() {
    afterNextRender(async () => {
      const { createEditor } = await import('./rete-editor');
      await createEditor(this.container().nativeElement, this.injector);
    });
  }
}
