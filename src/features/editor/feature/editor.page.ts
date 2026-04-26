import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EditorStore } from '../data-access/editor.store';
import { ConnectionEvent, MoveEvent, ReteCanvasComponent } from '../ui/rete-canvas.component';
import {
  ChoiceLabelUpdate,
  SceneEditorPanelComponent,
  SceneUpdate,
} from '../ui/scene-editor-panel.component';
import { StoryMetaPanelComponent } from '../ui/story-meta-panel.component';

@Component({
  selector: 'app-editor-page',
  imports: [
    RouterLink,
    ReteCanvasComponent,
    SceneEditorPanelComponent,
    StoryMetaPanelComponent,
  ],
  providers: [EditorStore],
  template: `
    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as err) {
      <p class="error">{{ err }}</p>
      <p><a routerLink="/edit">Back to my stories</a></p>
    } @else if (store.storyId()) {
      <header class="bar">
        <h2>
          {{ store.meta()?.title || 'Untitled story' }}
          @if (store.dirty()) {
            <span class="dirty" title="Unsaved changes">●</span>
          }
        </h2>
        <button type="button" (click)="store.addScene()">+ Add scene</button>
        <button
          type="button"
          [disabled]="!store.dirty() || store.saving()"
          (click)="store.save()"
        >
          {{ store.saving() ? 'Saving...' : 'Save' }}
        </button>
      </header>

      <div class="layout">
        <app-story-meta-panel
          [meta]="store.meta()"
          (update)="store.updateMeta($event)"
        />

        <app-rete-canvas
          [scenes]="store.scenes()"
          (move)="onMove($event)"
          (select)="store.selectScene($event)"
          (connect)="onConnect($event)"
          (disconnect)="onDisconnect($event)"
        />

        <app-scene-editor-panel
          [sceneId]="store.selectedSceneId()"
          [scene]="store.selectedScene()"
          [isStartScene]="isSelectedStart()"
          (update)="onUpdate($event)"
          (updateChoiceLabel)="onChoiceLabel($event)"
          (delete)="store.removeScene($event)"
          (setAsStart)="store.setStartScene($event)"
        />
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-shrink: 0;
    }
    .bar h2 {
      flex: 1;
      margin: 0;
    }
    .dirty {
      color: #b00020;
      margin-left: 0.5rem;
    }
    .error {
      color: #b00020;
    }
    .layout {
      display: grid;
      grid-template-columns: 280px 1fr 320px;
      gap: 1rem;
      flex: 1;
      min-height: 0;
    }
    .layout > * {
      min-height: 0;
      height: 100%;
      overflow: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPage {
  readonly id = input.required<string>();
  protected readonly store = inject(EditorStore);

  protected readonly isSelectedStart = computed(
    () => this.store.selectedSceneId() !== null
      && this.store.selectedSceneId() === this.store.startSceneId(),
  );

  constructor() {
    effect(() => {
      this.store.load(this.id());
    });
  }

  protected onMove(event: MoveEvent): void {
    this.store.moveScene(event.sceneId, event.position);
  }

  protected onConnect(event: ConnectionEvent): void {
    this.store.addConnection(event.from, event.to);
  }

  protected onDisconnect(event: ConnectionEvent): void {
    this.store.removeConnection(event.from, event.to);
  }

  protected onUpdate(event: SceneUpdate): void {
    this.store.updateScene(event.id, event.patch);
  }

  protected onChoiceLabel(event: ChoiceLabelUpdate): void {
    this.store.updateChoiceLabel(event.fromSceneId, event.toSceneId, event.label);
  }
}
