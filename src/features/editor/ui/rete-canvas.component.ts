import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Scene } from '@features/stories';
import type { EditorHandle } from '../data-access/rete-editor';

export interface MoveEvent {
  sceneId: string;
  position: { x: number; y: number };
}

export interface ConnectionEvent {
  from: string;
  to: string;
}

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
  readonly scenes = input.required<Record<string, Scene>>();

  readonly move = output<MoveEvent>();
  readonly select = output<string | null>();
  readonly connect = output<ConnectionEvent>();
  readonly disconnect = output<ConnectionEvent>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private handle?: EditorHandle;

  constructor() {
    afterNextRender(async () => {
      const { createEditor } = await import('../data-access/rete-editor');
      this.handle = await createEditor({
        container: this.container().nativeElement,
        injector: this.injector,
        scenes: this.scenes(),
        onMove: (sceneId, position) => this.move.emit({ sceneId, position }),
        onSelect: (sceneId) => this.select.emit(sceneId),
        onConnect: (from, to) => this.connect.emit({ from, to }),
        onDisconnect: (from, to) => this.disconnect.emit({ from, to }),
      });
    });

    this.destroyRef.onDestroy(() => this.handle?.destroy());
  }
}
