import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CharactersService } from '@features/characters';
import { CodexEntriesService } from '@features/codex';
import { AssetPickerComponent, MediaAssetsService } from '@features/media';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { EntityKind, EntityRef, InGameDate, SLUG_PATTERN } from '@shared/models';
import { EntityResolverService } from '@shared/data-access';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  InGameDateInputComponent,
  RichTextInputComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { StoryMeta } from '../data-access/editor.state';
import editorEn from '../i18n/en.json';
import editorUk from '../i18n/uk.json';

function refKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function parseRefKey(key: string): EntityRef | null {
  const idx = key.indexOf(':');
  if (idx === -1) return null;
  const kind = key.slice(0, idx) as EntityKind;
  const id = key.slice(idx + 1);
  if (!id) return null;
  return { kind, id };
}

@Component({
  selector: 'app-story-meta-panel',
  imports: [
    AssetPickerComponent,
    ComboboxPickerComponent,
    InGameDateInputComponent,
    RichTextInputComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    NgOptimizedImage,
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
      @if (meta(); as m) {
        <h3>{{ t('field.storyInfo') }}</h3>

        <div class="field">
          <label for="meta-title">{{ t('field.title') }}</label>
          <input id="meta-title" type="text" [value]="m.title" (input)="onTitle($event)" />
        </div>

        <div class="field">
          <label for="meta-slug">{{ t('field.slug') }}</label>
          <input
            id="meta-slug"
            type="text"
            [value]="m.slug"
            [class.invalid]="!slugValid()"
            (input)="onSlug($event)"
          />
          <span class="hint">{{ t('empty.slugHint') }}</span>
          @if (!slugValid()) {
            <span class="error">{{ t('empty.slugError') }}</span>
          }
        </div>

        <div class="field">
          <label>{{ t('field.coverImage') }}</label>
          @if (coverUrl(); as url) {
            <div class="cover-preview">
              <img [ngSrc]="url" [alt]="t('tooltip.storyCoverAlt')" fill class="cover-img" />
            </div>
            <div class="cover-actions">
              <button uiSecondary type="button" (click)="coverPicker.open()">
                {{ t('action.replace') }}
              </button>
              <button uiGhost type="button" (click)="clearCover()">{{ t('action.remove') }}</button>
            </div>
          } @else {
            <button uiSecondary type="button" (click)="coverPicker.open()">
              {{ t('action.pickCover') }}
            </button>
            <span class="hint">{{ t('empty.coverHint') }}</span>
          }
          <app-asset-picker
            #coverPicker
            kind="cover"
            [title]="t('tooltip.pickCoverTitle')"
            [currentSelection]="coverSelection()"
            (picked)="onCoverPicked($event)"
          />
        </div>

        <div class="field">
          <label>{{ t('field.description') }}</label>
          <app-rich-text-input
            [value]="m.description ?? ''"
            [options]="inlineRefOptions()"
            [ariaLabel]="t('tooltip.descriptionAria')"
            [placeholder]="t('empty.descriptionPlaceholder')"
            (valueChange)="onDescription($event)"
          />
        </div>

        <div class="field">
          <label>{{ t('field.relatedEntities') }}</label>
          <app-combobox-picker
            [options]="relatedOptions()"
            [value]="relatedKeys()"
            [placeholder]="t('empty.relatedPlaceholder')"
            [emptyMessage]="t('empty.noRelatedAvailable')"
            (valueChange)="onRelatedKeys($event)"
          />
        </div>

        <div class="field">
          <label>{{ t('field.plotlines') }}</label>
          <app-combobox-picker
            [options]="plotlineOptions()"
            [value]="plotlineIds()"
            [placeholder]="t('empty.plotlinesPlaceholder')"
            [emptyMessage]="t('empty.noPlotlines')"
            (valueChange)="onPlotlineIds($event)"
          />
        </div>

        <div class="field">
          <app-in-game-date-input
            [label]="t('field.inGameDate')"
            [value]="m.inGameDate"
            (valueChanged)="onDate($event)"
          />
        </div>

        <div class="field checkbox">
          <label>
            <input type="checkbox" [checked]="m.draft" (change)="onDraft($event)" />
            {{ t('field.draftCheckbox') }}
          </label>
        </div>
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
    h3 {
      margin: 0 0 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 1rem;
    }
    .field.checkbox label {
      flex-direction: row;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
    .field label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-foreground-subtle);
    }
    .hint {
      font-size: 0.75rem;
      color: var(--color-foreground-faint);
    }
    .error {
      font-size: 0.75rem;
      color: var(--color-danger-foreground);
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
    input[type='text'].invalid {
      border-color: var(--color-danger-foreground);
    }
    textarea {
      resize: vertical;
    }
    .hidden {
      display: none;
    }
    .cover-preview {
      position: relative;
      aspect-ratio: 16 / 9;
      width: 100%;
      overflow: hidden;
      border-radius: 0.25rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-muted);
    }
    .cover-img {
      object-fit: cover;
    }
    .cover-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryMetaPanelComponent {
  readonly meta = input.required<StoryMeta | null>();
  readonly update = output<Partial<StoryMeta>>();

  private readonly media = inject(MediaAssetsService);
  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly codex = inject(CodexEntriesService);
  private readonly plotlines = inject(PlotlinesService);
  private readonly entityResolver = inject(EntityResolverService);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly coverUrl = computed(() => this.media.urlFor(this.meta()?.coverAssetId));
  protected readonly coverSelection = computed(() => {
    const id = this.meta()?.coverAssetId;
    return id ? [id] : [];
  });

  protected readonly slugValid = computed(() => {
    const m = this.meta();
    if (!m) return true;
    return SLUG_PATTERN.test(m.slug);
  });

  private readonly relatedKindLabels = computed<Record<'character' | 'place' | 'codexEntry', string>>(
    () => {
      this.activeLang();
      return {
        character: this.transloco.translate('editor.field.relatedKindCharacter'),
        place: this.transloco.translate('editor.field.relatedKindPlace'),
        codexEntry: this.transloco.translate('editor.field.relatedKindCodex'),
      };
    },
  );

  protected readonly relatedOptions = computed<ComboboxOption[]>(() => {
    const labels = this.relatedKindLabels();
    return [
      ...this.characters.characters().map((c) => ({
        id: refKey({ kind: 'character', id: c.id }),
        label: c.name,
        hint: labels.character,
        kind: 'character' as const,
      })),
      ...this.places.places().map((p) => ({
        id: refKey({ kind: 'place', id: p.id }),
        label: p.name,
        hint: labels.place,
        kind: 'place' as const,
      })),
      ...this.codex.entries().map((e) => ({
        id: refKey({ kind: 'codexEntry', id: e.id }),
        label: e.title,
        hint: labels.codexEntry,
        kind: 'codexEntry' as const,
      })),
    ];
  });

  protected readonly plotlineOptions = computed<ComboboxOption[]>(() =>
    this.plotlines
      .plotlines()
      .map((p) => ({ id: p.id, label: p.title, hint: p.slug, kind: 'plotline' as const })),
  );

  protected readonly relatedKeys = computed(() => (this.meta()?.relatedRefs ?? []).map(refKey));
  protected readonly plotlineIds = computed(() => (this.meta()?.plotlineRefs ?? []).map((r) => r.id));

  protected onTitle(event: Event): void {
    this.update.emit({ title: (event.target as HTMLInputElement).value });
  }

  protected onSlug(event: Event): void {
    this.update.emit({ slug: (event.target as HTMLInputElement).value });
  }

  protected onDescription(value: string): void {
    this.update.emit({ description: value || undefined });
  }

  protected onRelatedKeys(keys: string[]): void {
    const refs: EntityRef[] = [];
    for (const k of keys) {
      const ref = parseRefKey(k);
      if (ref) refs.push(ref);
    }
    this.update.emit({ relatedRefs: refs.length > 0 ? refs : undefined });
  }

  protected onPlotlineIds(ids: string[]): void {
    const refs: EntityRef<'plotline'>[] = ids.map((id) => ({ kind: 'plotline', id }));
    this.update.emit({ plotlineRefs: refs.length > 0 ? refs : undefined });
  }

  protected onDate(value: InGameDate): void {
    this.update.emit({ inGameDate: value });
  }

  protected onDraft(event: Event): void {
    this.update.emit({ draft: (event.target as HTMLInputElement).checked });
  }

  protected onCoverPicked(ids: string[]): void {
    this.update.emit({ coverAssetId: ids[0] });
  }

  protected clearCover(): void {
    this.update.emit({ coverAssetId: undefined });
  }
}
