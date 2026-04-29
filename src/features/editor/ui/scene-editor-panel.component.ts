import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CharacterPortrait } from '@features/characters';
import { Scene, StagedCharacter } from '@features/stories';
import { EntityRef } from '@shared/models';
import {
  DangerButtonComponent,
  EntityPickerComponent,
  EntityPickerOption,
  GhostButtonComponent,
  RichTextInputComponent,
} from '@shared/ui';
import { InlineRefOption } from '@shared/utils';
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

type SpeakerMode = 'none' | 'character' | 'custom';

@Component({
  selector: 'app-scene-editor-panel',
  imports: [
    GhostButtonComponent,
    DangerButtonComponent,
    EntityPickerComponent,
    RichTextInputComponent,
    SceneAssetsPanelComponent,
  ],
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

        <fieldset class="group">
          <legend>Speaker</legend>
          <div class="modes" role="radiogroup" aria-label="Speaker type">
            @for (m of speakerModes; track m.value) {
              <label class="mode">
                <input
                  type="radio"
                  name="speakerMode"
                  [value]="m.value"
                  [checked]="speakerMode() === m.value"
                  (change)="onSpeakerMode(id, m.value)"
                />
                {{ m.label }}
              </label>
            }
          </div>

          @if (speakerMode() === 'character') {
            <app-entity-picker
              kind="character"
              [options]="characterOptions()"
              [value]="speakerRefArray()"
              [multiple]="false"
              emptyMessage="No characters in this universe yet."
              (selected)="onSpeakerCharacter(id, $event)"
            />
            @if (speakerNotOnStage()) {
              <div class="warning" role="status">
                <span>Speaker is not on stage.</span>
                <button uiGhost type="button" (click)="addSpeakerToStage(id)">
                  Add to stage
                </button>
              </div>
            }
          } @else if (speakerMode() === 'custom') {
            <input
              type="text"
              placeholder="Narrator, off-screen voice…"
              [value]="speakerString()"
              (input)="onSpeakerCustom($event, id)"
            />
          }
        </fieldset>

        <div class="field">
          <label>Text</label>
          <app-rich-text-input
            [value]="s.text"
            [options]="inlineRefOptions()"
            ariaLabel="Scene text"
            placeholder="Write the scene…"
            (valueChange)="emitTextValue(id, $event)"
          />
        </div>

        <fieldset class="group">
          <legend>On stage ({{ s.characters.length }})</legend>
          @if (s.characters.length === 0) {
            <p class="hint">No characters on stage. Add one below.</p>
          } @else {
            <ul class="staged">
              @for (sc of s.characters; track sc.entity.id) {
                <li class="staged-row">
                  <span class="staged-name">{{ characterName(sc.entity.id) }}</span>
                  <select
                    [value]="sc.position"
                    (change)="onPositionChange($event, id, sc.entity.id)"
                  >
                    @for (p of positionOptions; track p) {
                      <option [value]="p">{{ p }}</option>
                    }
                  </select>
                  @if (portraitOptions(sc.entity.id).length > 1) {
                    <select
                      [value]="sc.portraitId ?? ''"
                      [attr.aria-label]="'Portrait for ' + characterName(sc.entity.id)"
                      (change)="onPortraitChange($event, id, sc.entity.id)"
                    >
                      @for (po of portraitOptions(sc.entity.id); track po.id) {
                        <option [value]="po.id">{{ po.label }}</option>
                      }
                    </select>
                  }
                  <button
                    type="button"
                    class="remove"
                    [attr.aria-label]="'Remove ' + characterName(sc.entity.id) + ' from stage'"
                    (click)="removeStaged(id, sc.entity.id)"
                  >
                    ×
                  </button>
                </li>
              }
            </ul>
          }
          <app-entity-picker
            kind="character"
            [options]="unstagedOptions()"
            [value]="emptyValue"
            [multiple]="false"
            emptyMessage="All characters are on stage."
            (selected)="onAddStaged(id, $event)"
          />
        </fieldset>

        <div class="field">
          <label>Place</label>
          <app-entity-picker
            kind="place"
            [options]="placeOptions()"
            [value]="placeRefArray()"
            [multiple]="false"
            emptyMessage="No places in this universe yet."
            (selected)="onPlace(id, $event)"
          />
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
    .group {
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      padding: 0.5rem 0.75rem 0.75rem;
      margin: 0 0 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .group legend {
      padding: 0 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #4b5563;
    }
    .modes {
      display: flex;
      gap: 1rem;
    }
    .mode {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .warning {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border: 1px solid #fbbf24;
      background: #fef3c7;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      color: #92400e;
    }
    .warning span {
      flex: 1;
    }
    .staged {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .staged-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .staged-name {
      flex: 1;
      font-size: 0.875rem;
    }
    .staged-row select {
      padding: 0.25rem 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      font: inherit;
      font-size: 0.875rem;
    }
    .remove {
      width: 1.5rem;
      height: 1.5rem;
      border: none;
      border-radius: 999px;
      background: #fee2e2;
      color: #991b1b;
      cursor: pointer;
      font-size: 0.875rem;
      line-height: 1;
    }
    .remove:hover {
      background: #fecaca;
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
  readonly characterOptions = input<EntityPickerOption[]>([]);
  readonly placeOptions = input<EntityPickerOption[]>([]);
  readonly characterPortraits = input<Record<string, CharacterPortrait[]>>({});
  readonly inlineRefOptions = input<InlineRefOption[]>([]);

  readonly update = output<SceneUpdate>();
  readonly updateChoiceLabel = output<ChoiceLabelUpdate>();
  readonly remove = output<string>();
  readonly setAsStart = output<string>();

  protected readonly speakerModes: { value: SpeakerMode; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'character', label: 'Character' },
    { value: 'custom', label: 'Custom' },
  ];
  protected readonly positionOptions = ['left', 'center', 'right'];
  protected readonly emptyValue: EntityRef[] = [];

  protected readonly speakerMode = computed<SpeakerMode>(() => {
    const sp = this.scene()?.speaker;
    if (sp === undefined) return 'none';
    if (typeof sp === 'string') return 'custom';
    return 'character';
  });

  protected readonly speakerRefArray = computed<EntityRef<'character'>[]>(() => {
    const sp = this.scene()?.speaker;
    return sp && typeof sp !== 'string' ? [sp] : [];
  });

  protected readonly speakerString = computed<string>(() => {
    const sp = this.scene()?.speaker;
    return typeof sp === 'string' ? sp : '';
  });

  protected readonly placeRefArray = computed<EntityRef<'place'>[]>(() => {
    const p = this.scene()?.place;
    return p ? [p] : [];
  });

  protected readonly speakerNotOnStage = computed<boolean>(() => {
    const sp = this.scene()?.speaker;
    if (!sp || typeof sp === 'string') return false;
    const chars = this.scene()?.characters ?? [];
    return !chars.some((c) => c.entity.id === sp.id);
  });

  protected readonly unstagedOptions = computed<EntityPickerOption[]>(() => {
    const staged = new Set((this.scene()?.characters ?? []).map((c) => c.entity.id));
    return this.characterOptions().filter((o) => !staged.has(o.id));
  });

  protected characterName(id: string): string {
    return this.characterOptions().find((o) => o.id === id)?.label ?? id;
  }

  protected portraitOptions(characterId: string): { id: string; label: string }[] {
    const list = this.characterPortraits()[characterId] ?? [];
    if (list.length === 0) return [];
    return [{ id: '', label: '(default)' }, ...list.map((p) => ({ id: p.id, label: p.label }))];
  }

  protected emitTextValue(id: string, value: string): void {
    this.update.emit({ id, patch: { text: value } });
  }

  protected onSpeakerMode(id: string, mode: SpeakerMode): void {
    let speaker: Scene['speaker'];
    if (mode === 'none') speaker = undefined;
    else if (mode === 'custom') speaker = '';
    else speaker = undefined;
    this.update.emit({ id, patch: { speaker } });
  }

  protected onSpeakerCharacter(id: string, refs: EntityRef[]): void {
    const ref = refs[0] as EntityRef<'character'> | undefined;
    this.update.emit({ id, patch: { speaker: ref } });
  }

  protected onSpeakerCustom(event: Event, id: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.update.emit({ id, patch: { speaker: value } });
  }

  protected onPlace(id: string, refs: EntityRef[]): void {
    const ref = refs[0] as EntityRef<'place'> | undefined;
    this.update.emit({ id, patch: { place: ref } });
  }

  protected addSpeakerToStage(id: string): void {
    const sp = this.scene()?.speaker;
    if (!sp || typeof sp === 'string') return;
    const current = this.scene()?.characters ?? [];
    if (current.some((c) => c.entity.id === sp.id)) return;
    const next: StagedCharacter[] = [...current, { entity: sp, position: 'center' }];
    this.update.emit({ id, patch: { characters: next } });
  }

  protected onAddStaged(id: string, refs: EntityRef[]): void {
    const ref = refs[0] as EntityRef<'character'> | undefined;
    if (!ref) return;
    const current = this.scene()?.characters ?? [];
    if (current.some((c) => c.entity.id === ref.id)) return;
    const next: StagedCharacter[] = [...current, { entity: ref, position: 'center' }];
    this.update.emit({ id, patch: { characters: next } });
  }

  protected removeStaged(id: string, characterId: string): void {
    const current = this.scene()?.characters ?? [];
    const next = current.filter((c) => c.entity.id !== characterId);
    this.update.emit({ id, patch: { characters: next } });
  }

  protected onPositionChange(event: Event, id: string, characterId: string): void {
    const position = (event.target as HTMLSelectElement).value;
    const current = this.scene()?.characters ?? [];
    const next = current.map((c) =>
      c.entity.id === characterId ? { ...c, position } : c,
    );
    this.update.emit({ id, patch: { characters: next } });
  }

  protected onPortraitChange(event: Event, id: string, characterId: string): void {
    const value = (event.target as HTMLSelectElement).value;
    const portraitId = value || undefined;
    const current = this.scene()?.characters ?? [];
    const next = current.map((c) =>
      c.entity.id === characterId ? { ...c, portraitId } : c,
    );
    this.update.emit({ id, patch: { characters: next } });
  }

  protected emitChoiceLabel(event: Event, fromSceneId: string, toSceneId: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateChoiceLabel.emit({ fromSceneId, toSceneId, label: value || undefined });
  }

  protected shortId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
  }
}
