import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  Injector,
  inject,
  input,
  output,
  signal,
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

function connectionsOf(scenes: Record<string, Scene>): Set<string> {
  const out = new Set<string>();
  for (const [fromId, scene] of Object.entries(scenes)) {
    for (const next of scene.next) out.add(`${fromId}|${next.sceneId}`);
  }
  return out;
}

@Component({
  selector: 'app-rete-canvas',
  template: `<div #container class="rete-container"></div>`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .rete-container {
      width: 100%;
      height: 100%;
      min-height: 400px;
      border: 1px solid #ccc;
      background: #fafafa;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReteCanvasComponent {
  readonly scenes = input.required<Record<string, Scene>>();

  readonly move = output<MoveEvent>();
  readonly selectScene = output<string | null>();
  readonly connect = output<ConnectionEvent>();
  readonly disconnect = output<ConnectionEvent>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private handle?: EditorHandle;
  private readonly handleReady = signal(false);
  private knownIds = new Set<string>();
  private knownTexts = new Map<string, string>();
  private knownConnections = new Set<string>();

  constructor() {
    afterNextRender(async () => {
      const { createEditor } = await import('../data-access/rete-editor');
      const initial = this.scenes();
      this.handle = await createEditor({
        container: this.container().nativeElement,
        injector: this.injector,
        scenes: initial,
        onMove: (sceneId, position) => this.move.emit({ sceneId, position }),
        onSelect: (sceneId) => this.selectScene.emit(sceneId),
        onConnect: (from, to) => {
          this.knownConnections.add(`${from}|${to}`);
          this.connect.emit({ from, to });
        },
        onDisconnect: (from, to) => {
          this.knownConnections.delete(`${from}|${to}`);
          this.disconnect.emit({ from, to });
        },
      });
      this.knownIds = new Set(Object.keys(initial));
      this.knownTexts = new Map(Object.entries(initial).map(([id, s]) => [id, s.text]));
      this.knownConnections = connectionsOf(initial);
      this.handleReady.set(true);
    });

    effect(() => {
      const scenes = this.scenes();
      if (!this.handleReady() || !this.handle) return;

      const currentIds = new Set(Object.keys(scenes));

      for (const id of currentIds) {
        const scene = scenes[id];
        if (!this.knownIds.has(id)) {
          this.handle.addNode(id, scene);
          this.knownIds.add(id);
          this.knownTexts.set(id, scene.text);
        } else if (this.knownTexts.get(id) !== scene.text) {
          this.handle.updateLabel(id, scene);
          this.knownTexts.set(id, scene.text);
        }
      }

      const currentConnections = connectionsOf(scenes);
      for (const key of currentConnections) {
        if (!this.knownConnections.has(key)) {
          const [from, to] = key.split('|');
          this.handle.addConnection(from, to);
          this.knownConnections.add(key);
        }
      }
      for (const key of [...this.knownConnections]) {
        if (!currentConnections.has(key)) {
          const [from, to] = key.split('|');
          this.handle.removeConnection(from, to);
          this.knownConnections.delete(key);
        }
      }

      for (const id of [...this.knownIds]) {
        if (!currentIds.has(id)) {
          this.handle.removeNode(id);
          this.knownIds.delete(id);
          this.knownTexts.delete(id);
        }
      }
    });

    this.destroyRef.onDestroy(() => this.handle?.destroy());
  }
}
