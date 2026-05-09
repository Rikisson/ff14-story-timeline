import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
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
import editorEn from '../i18n/en.json';
import editorUk from '../i18n/uk.json';

export interface SceneUpdate {
  id: string;
  patch: Partial<Scene>;
}

export interface ChoiceLabelUpdate {
  fromSceneId: string;
  toSceneId: string;
  label: string | undefined;
}

export interface ChoiceReorder {
  sceneId: string;
  fromIndex: number;
  toIndex: number;
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
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'editor',
      loader: {
        en: () => Promise.resolve(editorEn),
        uk: () => Promise.resolve(editorUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'editor'">
      @if (sceneId(); as id) {
        @if (scene(); as s) {
          <header class="header">
            <h3>{{ t('field.scenePrefix') }} <code>{{ headLabel(id, s) }}</code></h3>
            @if (isStartScene()) {
              <span class="badge">{{ t('field.startBadge') }}</span>
            } @else {
              <button uiGhost type="button" (click)="confirmSetAsStart(id)">{{ t('action.setAsStart') }}</button>
            }
          </header>
          <p class="full-id" [title]="id">{{ t('field.sceneIdPrefix') }} {{ id }}</p>

          <div class="field">
            <label for="scene-label">{{ t('field.label') }}</label>
            <input
              id="scene-label"
              type="text"
              [placeholder]="t('empty.sceneShorthandPlaceholder')"
              [value]="s.label ?? ''"
              (input)="emitLabel($event, id)"
            />
            <span class="hint">
              {{ t('empty.labelHint') }}
            </span>
          </div>

          <fieldset class="group">
            <legend>{{ t('field.speaker') }}</legend>
            <div class="modes" role="radiogroup" [attr.aria-label]="t('field.speakerType')">
              @for (m of speakerModes(); track m.value) {
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
                [emptyMessage]="t('empty.noCharactersUniverse')"
                (selected)="onSpeakerCharacter(id, $event)"
              />
              @if (speakerNotOnStage()) {
                <div class="warning" role="status">
                  <span>{{ t('message.speakerNotOnStage') }}</span>
                  <button uiGhost type="button" (click)="addSpeakerToStage(id)">
                    {{ t('action.addToStage') }}
                  </button>
                </div>
              }
            } @else if (speakerMode() === 'custom') {
              <input
                type="text"
                [placeholder]="t('empty.speakerCustomPlaceholder')"
                [value]="speakerString()"
                (input)="onSpeakerCustom($event, id)"
              />
            }
          </fieldset>

          <div class="field">
            <label>{{ t('field.text') }}</label>
            <app-rich-text-input
              [value]="s.text"
              [options]="inlineRefOptions()"
              [ariaLabel]="t('tooltip.sceneTextAria')"
              [placeholder]="t('empty.textPlaceholder')"
              (valueChange)="emitTextValue(id, $event)"
            />
          </div>

          <fieldset class="group">
            <legend>{{ t('message.onStageCount', { count: s.characters.length }) }}</legend>
            @if (s.characters.length === 0) {
              <p class="hint">{{ t('empty.noStaged') }}</p>
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
                    @if (spriteOptions(sc.entity.id).length > 1) {
                      <select
                        [value]="sc.spriteId ?? ''"
                        [attr.aria-label]="t('tooltip.spriteForCharacter', { name: characterName(sc.entity.id) })"
                        (change)="onSpriteChange($event, id, sc.entity.id)"
                      >
                        @for (po of spriteOptions(sc.entity.id); track po.id) {
                          <option [value]="po.id">{{ po.label }}</option>
                        }
                      </select>
                    }
                    <button
                      type="button"
                      class="remove"
                      [attr.aria-label]="t('tooltip.removeFromStage', { name: characterName(sc.entity.id) })"
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
              [emptyMessage]="t('empty.allOnStage')"
              (selected)="onAddStaged(id, $event)"
            />
          </fieldset>

          <div class="field">
            <label>{{ t('field.place') }}</label>
            <app-entity-picker
              kind="place"
              [options]="placeOptions()"
              [value]="placeRefArray()"
              [multiple]="false"
              [emptyMessage]="t('empty.noPlacesUniverse')"
              (selected)="onPlace(id, $event)"
            />
          </div>

          <h4>{{ t('message.choicesCount', { count: s.next.length }) }}</h4>
          @if (s.next.length === 0) {
            <p class="hint">{{ t('empty.noChoicesHint') }}</p>
          } @else {
            @if (s.next.length > 1) {
              <p class="hint">{{ t('empty.reorderHint') }}</p>
            }
            <ul class="choices">
              @for (choice of s.next; track choice.sceneId; let i = $index) {
                <li
                  class="choice"
                  [class.dragging]="dragIndex() === i"
                  [class.drag-over]="dragOverIndex() === i && dragIndex() !== i"
                  (dragover)="onDragOver($event, i)"
                  (dragleave)="onDragLeave(i)"
                  (drop)="onDrop($event, id, i)"
                >
                  <button
                    type="button"
                    class="handle"
                    draggable="true"
                    [attr.aria-label]="t('tooltip.reorderChoice', { index: i + 1, total: s.next.length })"
                    (dragstart)="onDragStart($event, i)"
                    (dragend)="onDragEnd()"
                  >
                    ⋮⋮
                  </button>
                  <span class="arrow" [title]="choice.sceneId">
                    → <code>{{ destLabel(choice.sceneId) }}</code>
                  </span>
                  <input
                    type="text"
                    [placeholder]="t('empty.choiceLabelPlaceholder')"
                    [value]="choice.label ?? ''"
                    (input)="emitChoiceLabel($event, id, choice.sceneId)"
                  />
                </li>
              }
            </ul>
          }

          <hr />

          <app-scene-assets-panel
            [backgroundAssetId]="s.backgroundAssetId"
            [audioAssetId]="s.audioAssetId"
            (update)="update.emit({ id, patch: $event })"
          />

          <hr />

          <button uiDanger type="button" (click)="remove.emit(id)" [disabled]="isStartScene()">
            {{ t('action.deleteScene') }}
          </button>
          @if (isStartScene()) {
            <p class="hint">{{ t('empty.cantDeleteStartHint') }}</p>
          }
        }
      } @else {
        <p class="empty">{{ t('empty.selectSceneHint') }}</p>
      }
    </ng-container>
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
      border: 1px solid var(--color-border);
      border-radius: 0.5rem;
      background: var(--color-surface);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }
    .header h3 {
      margin: 0;
      flex: 1;
    }
    .full-id {
      margin: 0 0 1rem;
      color: var(--color-foreground-faint);
      font-size: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .badge {
      background: var(--color-success);
      color: var(--color-success-foreground);
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
      color: var(--color-foreground-subtle);
    }
    .group {
      border: 1px solid var(--color-border);
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
      color: var(--color-foreground-subtle);
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
      border: 1px solid var(--color-warning-border);
      background: var(--color-warning);
      border-radius: 0.25rem;
      font-size: 0.875rem;
      color: var(--color-warning-foreground);
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
      border: 1px solid var(--color-border-strong);
      border-radius: 0.25rem;
      font: inherit;
      font-size: 0.875rem;
      background: var(--color-surface);
      color: inherit;
    }
    .remove {
      width: 1.5rem;
      height: 1.5rem;
      border: none;
      border-radius: 999px;
      background: var(--color-danger);
      color: var(--color-danger-foreground);
      cursor: pointer;
      font-size: 0.875rem;
      line-height: 1;
    }
    .remove:hover {
      background: var(--color-danger-border);
    }
    input[type='text'],
    textarea {
      padding: 0.5rem;
      border: 1px solid var(--color-border-strong);
      border-radius: 0.25rem;
      font: inherit;
      background: var(--color-surface);
      color: inherit;
    }
    textarea {
      resize: vertical;
    }
    .choices {
      list-style: none;
      padding: 0;
      margin: 0 0 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .choice {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 0.5rem;
      row-gap: 0.25rem;
      align-items: center;
      padding: 0.375rem 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: 0.25rem;
      background: var(--color-surface);
    }
    .choice.dragging {
      opacity: 0.5;
    }
    .choice.drag-over {
      border-color: var(--color-accent-ring);
      background: var(--color-accent-soft);
    }
    .handle {
      grid-row: span 2;
      width: 1.5rem;
      height: 100%;
      min-height: 2rem;
      border: none;
      background: transparent;
      color: var(--color-foreground-faint);
      cursor: grab;
      font-size: 1rem;
      line-height: 1;
      padding: 0;
    }
    .handle:active {
      cursor: grabbing;
    }
    .handle:focus-visible {
      outline: 2px solid var(--color-accent-ring);
      outline-offset: 2px;
      border-radius: 0.25rem;
    }
    .arrow {
      font-size: 0.875rem;
      color: var(--color-foreground-faint);
    }
    .choice input {
      grid-column: 2;
      width: 100%;
      box-sizing: border-box;
    }
    .hint {
      color: var(--color-foreground-faint);
      font-size: 0.875rem;
    }
    .empty {
      color: var(--color-foreground-faint);
      font-style: italic;
    }
    hr {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 1rem 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneEditorPanelComponent {
  readonly sceneId = input.required<string | null>();
  readonly scene = input.required<Scene | null>();
  readonly isStartScene = input.required<boolean>();
  readonly characterOptions = input<EntityPickerOption[]>([]);
  readonly placeOptions = input<EntityPickerOption[]>([]);
  readonly characterSprites = input<Record<string, { id: string; label: string }[]>>({});
  readonly inlineRefOptions = input<InlineRefOption[]>([]);
  readonly sceneLabels = input<Record<string, string>>({});

  readonly update = output<SceneUpdate>();
  readonly updateChoiceLabel = output<ChoiceLabelUpdate>();
  readonly reorderChoices = output<ChoiceReorder>();
  readonly remove = output<string>();
  readonly setAsStart = output<string>();

  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly dragIndex = signal<number | null>(null);
  protected readonly dragOverIndex = signal<number | null>(null);

  protected readonly speakerModes = computed<{ value: SpeakerMode; label: string }[]>(() => {
    this.activeLang();
    return [
      { value: 'none', label: this.transloco.translate('editor.field.speakerModeNone') },
      { value: 'character', label: this.transloco.translate('editor.field.speakerModeCharacter') },
      { value: 'custom', label: this.transloco.translate('editor.field.speakerModeCustom') },
    ];
  });
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

  protected spriteOptions(characterId: string): { id: string; label: string }[] {
    const list = this.characterSprites()[characterId] ?? [];
    if (list.length === 0) return [];
    return [
      { id: '', label: this.transloco.translate('editor.empty.spriteDefault') },
      ...list,
    ];
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

  protected onSpriteChange(event: Event, id: string, characterId: string): void {
    const value = (event.target as HTMLSelectElement).value;
    const spriteId = value || undefined;
    const current = this.scene()?.characters ?? [];
    const next = current.map((c) =>
      c.entity.id === characterId ? { ...c, spriteId } : c,
    );
    this.update.emit({ id, patch: { characters: next } });
  }

  protected emitChoiceLabel(event: Event, fromSceneId: string, toSceneId: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateChoiceLabel.emit({ fromSceneId, toSceneId, label: value || undefined });
  }

  protected emitLabel(event: Event, id: string): void {
    const value = (event.target as HTMLInputElement).value;
    this.update.emit({ id, patch: { label: value || undefined } });
  }

  protected headLabel(id: string, scene: Scene): string {
    return scene.label?.trim() || this.shortId(id);
  }

  protected destLabel(targetId: string): string {
    return this.sceneLabels()[targetId] ?? this.shortId(targetId);
  }

  protected confirmSetAsStart(id: string): void {
    const ok = window.confirm(this.transloco.translate('editor.message.setAsStartConfirm'));
    if (ok) this.setAsStart.emit(id);
  }

  protected onDragStart(event: DragEvent, index: number): void {
    this.dragIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  protected onDragOver(event: DragEvent, index: number): void {
    if (this.dragIndex() === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverIndex.set(index);
  }

  protected onDragLeave(index: number): void {
    if (this.dragOverIndex() === index) this.dragOverIndex.set(null);
  }

  protected onDrop(event: DragEvent, sceneId: string, index: number): void {
    event.preventDefault();
    const from = this.dragIndex();
    this.dragIndex.set(null);
    this.dragOverIndex.set(null);
    if (from === null || from === index) return;
    this.reorderChoices.emit({ sceneId, fromIndex: from, toIndex: index });
  }

  protected onDragEnd(): void {
    this.dragIndex.set(null);
    this.dragOverIndex.set(null);
  }

  protected shortId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
  }
}
