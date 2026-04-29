import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PrimaryButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { EditorStore } from '../data-access/editor.store';
import { HasUnsavedChanges } from '../data-access/unsaved-changes.guard';
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
    PrimaryButtonComponent,
    SecondaryButtonComponent,
  ],
  providers: [EditorStore],
  template: `
    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as err) {
      <p class="error">{{ err }}</p>
      <p><a routerLink="/" [queryParams]="{ mineOnly: 'true' }">Back to my stories</a></p>
    } @else if (store.storyId()) {
      <header class="bar">
        <h1>
          {{ store.meta()?.title || 'Untitled story' }}
          @if (store.dirty()) {
            <span class="dirty" title="Unsaved changes">●</span>
          }
        </h1>
        <button uiSecondary type="button" (click)="store.addScene()">+ Add scene</button>
        <button
          uiPrimary
          type="button"
          [disabled]="!store.dirty() || !store.metaValid()"
          [loading]="store.saving()"
          (click)="store.save()"
        >
          Save
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
          (selectScene)="store.selectScene($event)"
          (connect)="onConnect($event)"
          (disconnect)="onDisconnect($event)"
        />

        <app-scene-editor-panel
          [sceneId]="store.selectedSceneId()"
          [scene]="store.selectedScene()"
          [isStartScene]="isSelectedStart()"
          [storyId]="store.storyId() ?? ''"
          (update)="onUpdate($event)"
          (updateChoiceLabel)="onChoiceLabel($event)"
          (remove)="store.removeScene($event)"
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
    .bar h1 {
      flex: 1;
      margin: 0;
      font-size: 1.25rem;
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
export class EditorPage implements HasUnsavedChanges {
  readonly id = input.required<string>();
  protected readonly store = inject(EditorStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isSelectedStart = computed(
    () => this.store.selectedSceneId() !== null
      && this.store.selectedSceneId() === this.store.startSceneId(),
  );

  constructor() {
    this.store.bindLoad(this.id);

    if (this.isBrowser) {
      const handler = (event: BeforeUnloadEvent) => {
        if (this.store.dirty()) {
          event.preventDefault();
          event.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', handler);
      this.destroyRef.onDestroy(() => window.removeEventListener('beforeunload', handler));
    }
  }

  hasUnsavedChanges(): boolean {
    return this.store.dirty();
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
