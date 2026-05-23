import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AssetPickerComponent } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { AssetThumbResolver } from '@shared/data-access';
import { EntityRef, InGameDate, SLUG_PATTERN } from '@shared/models';
import {
  EntityPickerComponent,
  GhostButtonComponent,
  InGameDateInputComponent,
  RichTextInputComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { StoryMeta } from '../data-access/editor.state';
import editorEn from '../i18n/en.json';
import editorUk from '../i18n/uk.json';

/** Per `docs/backend-rules.md` *Cardinality limits*. */
const RELATED_REFS_MAX = 50;
const PLOTLINE_REFS_MAX = 10;

@Component({
  selector: 'app-story-meta-panel',
  imports: [
    AssetPickerComponent,
    EntityPickerComponent,
    InGameDateInputComponent,
    RichTextInputComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    NgOptimizedImage,
    TranslocoDirective,
    ContentLangDirective,
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
        <h2>{{ t('field.storyInfo') }}</h2>

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
          <label>{{ t('field.bgm') }}</label>
          @if (bgmUrl(); as url) {
            <audio class="w-full" controls preload="none" [src]="url"></audio>
            <div class="cover-actions">
              <button uiSecondary type="button" (click)="bgmPicker.open()">
                {{ t('action.replaceBgm') }}
              </button>
              <button uiGhost type="button" (click)="clearBgm()">
                {{ t('action.removeBgm') }}
              </button>
            </div>
          } @else {
            <button uiSecondary type="button" (click)="bgmPicker.open()">
              {{ t('action.pickBgm') }}
            </button>
            <span class="hint">{{ t('empty.bgmHint') }}</span>
          }
          <app-asset-picker
            #bgmPicker
            kind="ambient"
            [title]="t('tooltip.pickBgmTitle')"
            [currentSelection]="bgmSelection()"
            (picked)="onBgmPicked($event)"
          />
        </div>

        <div class="field">
          <label>{{ t('field.description') }}</label>
          <app-rich-text-input
            appContentLang
            [value]="m.description ?? ''"
            [ariaLabel]="t('tooltip.descriptionAria')"
            [placeholder]="t('empty.descriptionPlaceholder')"
            (valueChange)="onDescription($event)"
          />
        </div>

        <div class="field">
          <label>{{ t('field.relatedEntities') }}</label>
          <app-entity-picker
            [value]="relatedRefs()"
            [kinds]="relatedKinds"
            [maxSelections]="relatedMax"
            [placeholder]="t('empty.relatedPlaceholder')"
            (valueChange)="onRelatedRefs($event)"
          />
        </div>

        <div class="field">
          <label>{{ t('field.plotlines') }}</label>
          <app-entity-picker
            [value]="plotlineRefValues()"
            [kinds]="plotlineKinds"
            [maxSelections]="plotlineMax"
            [placeholder]="t('empty.plotlinesPlaceholder')"
            (valueChange)="onPlotlineRefs($event)"
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
    h2 {
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

  private readonly assets = inject(AssetThumbResolver);

  protected readonly relatedKinds = ['character', 'place', 'codexEntry'] as const;
  protected readonly relatedMax = RELATED_REFS_MAX;
  protected readonly plotlineKinds = ['plotline'] as const;
  protected readonly plotlineMax = PLOTLINE_REFS_MAX;

  protected readonly coverUrl = computed(() =>
    this.assets.resolve(this.meta()?.coverAssetId)()?.url,
  );
  protected readonly coverSelection = computed(() => {
    const id = this.meta()?.coverAssetId;
    return id ? [id] : [];
  });

  protected readonly bgmUrl = computed(() =>
    this.assets.resolve(this.meta()?.bgmAssetId)()?.url,
  );
  protected readonly bgmSelection = computed(() => {
    const id = this.meta()?.bgmAssetId;
    return id ? [id] : [];
  });

  protected readonly slugValid = computed(() => {
    const m = this.meta();
    if (!m) return true;
    return SLUG_PATTERN.test(m.slug);
  });

  protected readonly relatedRefs = computed<EntityRef[]>(() => this.meta()?.relatedRefs ?? []);
  protected readonly plotlineRefValues = computed<EntityRef[]>(() => this.meta()?.plotlineRefs ?? []);

  protected onTitle(event: Event): void {
    this.update.emit({ title: (event.target as HTMLInputElement).value });
  }

  protected onSlug(event: Event): void {
    this.update.emit({ slug: (event.target as HTMLInputElement).value });
  }

  protected onDescription(value: string): void {
    this.update.emit({ description: value || undefined });
  }

  protected onRelatedRefs(refs: EntityRef[]): void {
    this.update.emit({ relatedRefs: refs.length > 0 ? refs : undefined });
  }

  protected onPlotlineRefs(refs: EntityRef[]): void {
    const plotlineOnly = refs.filter((r) => r.kind === 'plotline') as EntityRef<'plotline'>[];
    this.update.emit({ plotlineRefs: plotlineOnly.length > 0 ? plotlineOnly : undefined });
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

  protected onBgmPicked(ids: string[]): void {
    this.update.emit({ bgmAssetId: ids[0] });
  }

  protected clearBgm(): void {
    this.update.emit({ bgmAssetId: undefined });
  }
}
