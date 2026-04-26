import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Scene } from '@features/stories';

export interface SceneUpdate {
  id: string;
  patch: Partial<Scene>;
}

@Component({
  selector: 'app-scene-editor-panel',
  template: `
    @if (sceneId(); as id) {
      @if (scene(); as s) {
        <h3>Scene: <code>{{ id }}</code></h3>
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
          <textarea
            id="text"
            rows="8"
            [value]="s.text"
            (input)="emitText($event, id)"
          ></textarea>
        </div>
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
    h3 {
      margin: 0 0 1rem;
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
    input,
    textarea {
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      font: inherit;
    }
    textarea {
      resize: vertical;
    }
    .empty {
      color: #6b7280;
      font-style: italic;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneEditorPanelComponent {
  readonly sceneId = input.required<string | null>();
  readonly scene = input.required<Scene | null>();

  readonly update = output<SceneUpdate>();

  protected emitText(event: Event, id: string): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.update.emit({ id, patch: { text } });
  }

  protected emitSpeaker(event: Event, id: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.update.emit({ id, patch: { speaker: value || undefined } });
  }
}
