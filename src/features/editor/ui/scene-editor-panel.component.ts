import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';
import { Scene } from '@features/stories';
import { SceneAssetsPanelComponent } from './scene-assets-panel.component';

export interface SceneUpdate {
  id: string;
  patch: Partial<Scene>;
}

export interface ChoiceLabelUpdate {
  fromSceneId: string;
  toSceneId: string;
  label: string | undefined;
}

@Component({
  selector: 'app-scene-editor-panel',
  imports: [GhostButtonComponent, DangerButtonComponent, SceneAssetsPanelComponent],
  template: `
    @if (sceneId(); as id) {
      @if (scene(); as s) {
        <header class="header">
          <h3>Scene: <code>{{ id }}</code></h3>
          @if (isStartScene()) {
            <span class="badge">START</span>
          } @else {
            <button uiGhost type="button" (click)="setAsStart.emit(id)">Set as start</button>
          }
        </header>

        <div class="field">
          <label for="speaker">Speaker</label>
          <input
            id="speaker"
            type="text"
            placeholder="(none)"
            [value]="s.speaker ?? ''"
            (input)="emitSpeaker($event, id)"
          />
        </div>

        <div class="field">
          <label for="text">Text</label>
          <textarea id="text" rows="6" [value]="s.text" (input)="emitText($event, id)"></textarea>
        </div>

        <h4>Choices ({{ s.next.length }})</h4>
        @if (s.next.length === 0) {
          <p class="hint">Drag from this scene's "next" port to another scene to create a choice.</p>
        } @else {
          @for (choice of s.next; track choice.sceneId) {
            <div class="choice">
              <span class="arrow" [title]="choice.sceneId">
                → <code>{{ shortId(choice.sceneId) }}</code>
              </span>
              <input
                type="text"
                placeholder="Label (e.g. Yes / Continue)"
                [value]="choice.label ?? ''"
                (input)="emitChoiceLabel($event, id, choice.sceneId)"
              />
            </div>
          }
        }

        <hr />

        <app-scene-assets-panel
          [storyId]="storyId()"
          [sceneId]="id"
          [background]="s.background"
          [characters]="s.characters ?? []"
          [audio]="s.audio"
          (update)="update.emit({ id, patch: $event })"
        />

        <hr />

        <button uiDanger type="button" (click)="remove.emit(id)" [disabled]="isStartScene()">
          Delete scene
        </button>
        @if (isStartScene()) {
          <p class="hint">Set another scene as the start before deleting this one.</p>
        }
      }
    } @else {
      <p class="empty">Click a scene in the graph to edit it.</p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .header h3 {
      margin: 0;
      flex: 1;
    }
    .badge {
      background: #dcfce7;
      color: #166534;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    h4 {
      margin: 1rem 0 0.5rem;
      font-size: 0.875rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 1rem;
    }
    .field label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #4b5563;
    }
    input[type='text'],
    textarea {
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      font: inherit;
    }
    textarea {
      resize: vertical;
    }
    .choice {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.75rem;
    }
    .arrow {
      font-size: 0.875rem;
      color: #6b7280;
    }
    .choice input {
      width: 100%;
      box-sizing: border-box;
    }
    .hint {
      color: #6b7280;
      font-size: 0.875rem;
    }
    .empty {
      color: #6b7280;
      font-style: italic;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 1rem 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneEditorPanelComponent {
  readonly sceneId = input.required<string | null>();
  readonly scene = input.required<Scene | null>();
  readonly isStartScene = input.required<boolean>();
  readonly storyId = input.required<string>();

  readonly update = output<SceneUpdate>();
  readonly updateChoiceLabel = output<ChoiceLabelUpdate>();
  readonly remove = output<string>();
  readonly setAsStart = output<string>();

  protected emitText(event: Event, id: string): void {
    this.update.emit({ id, patch: { text: (event.target as HTMLTextAreaElement).value } });
  }

  protected emitSpeaker(event: Event, id: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.update.emit({ id, patch: { speaker: value || undefined } });
  }

  protected emitChoiceLabel(event: Event, fromSceneId: string, toSceneId: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateChoiceLabel.emit({ fromSceneId, toSceneId, label: value || undefined });
  }

  protected shortId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
  }
}
