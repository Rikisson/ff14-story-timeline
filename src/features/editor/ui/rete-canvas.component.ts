import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  inject,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-rete-canvas',
  template: `<div #container class="rete-container"></div>`,
  styles: `
    :host {
      display: block;
    }
    .rete-container {
      width: 100%;
      height: 600px;
      border: 1px solid #ccc;
      background: #fafafa;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReteCanvasComponent {
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly injector = inject(Injector);

  constructor() {
    afterNextRender(async () => {
      const { createEditor } = await import('../data-access/rete-editor');
      await createEditor(this.container().nativeElement, this.injector);
    });
  }
}
