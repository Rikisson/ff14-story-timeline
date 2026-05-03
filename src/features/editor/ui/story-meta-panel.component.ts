import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { StoryAssetsService } from '@features/stories';
import { InGameDate, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  EntityPickerOption,
  GhostButtonComponent,
  InGameDateInputComponent,
  RichTextInputComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { InlineRefOption } from '@shared/utils';
import { StoryMeta } from '../data-access/editor.state';

@Component({
  selector: 'app-story-meta-panel',
  imports: [
    ComboboxPickerComponent,
    InGameDateInputComponent,
    RichTextInputComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    NgOptimizedImage,
  ],
  template: `
    @if (meta(); as m) {
      <h3>Story info</h3>

      <div class="field">
        <label for="meta-title">Title</label>
        <input id="meta-title" type="text" [value]="m.title" (input)="onTitle($event)" />
      </div>

      <div class="field">
        <label for="meta-slug">Slug</label>
        <input
          id="meta-slug"
          type="text"
          [value]="m.slug"
          [class.invalid]="!slugValid()"
          (input)="onSlug($event)"
        />
        <span class="hint">Lowercase letters, digits, and hyphens. Unique within this universe.</span>
        @if (!slugValid()) {
          <span class="error">Slug must start with a letter or digit and contain only lowercase letters, digits, and hyphens.</span>
        }
      </div>

      <div class="field">
        <label>Cover image</label>
        @if (uploadError(); as e) {
          <span class="error">{{ e }}</span>
        }
        @if (m.coverImage; as url) {
          <div class="cover-preview">
            <img [ngSrc]="url" alt="Story cover" fill class="cover-img" />
          </div>
          <div class="cover-actions">
            <button
              uiSecondary
              type="button"
              [loading]="busy()"
              [disabled]="!storyId()"
              (click)="coverInput.click()"
            >
              Replace
            </button>
            <button uiGhost type="button" (click)="clearCover()">Remove</button>
          </div>
        } @else {
          <button
            uiSecondary
            type="button"
            [loading]="busy()"
            [disabled]="!storyId()"
            (click)="coverInput.click()"
          >
            Upload cover
          </button>
          <span class="hint">
            Used for the catalog card. Falls back to the start scene's background.
          </span>
        }
        <input
          #coverInput
          type="file"
          accept="image/*"
          class="hidden"
          (change)="onPick($event)"
        />
      </div>

      <div class="field">
        <label>Summary</label>
        <app-rich-text-input
          [value]="m.summary ?? ''"
          [options]="inlineRefOptions()"
          ariaLabel="Summary"
          placeholder="What is this story about?"
          (valueChange)="onSummary($event)"
        />
      </div>

      <div class="field">
        <label>Main characters</label>
        <app-combobox-picker
          [options]="characterCombobox()"
          [value]="characterIds()"
          placeholder="Search characters…"
          emptyMessage="No characters in this universe yet."
          (valueChange)="onCharacterIds($event)"
        />
      </div>

      <div class="field">
        <label>Places</label>
        <app-combobox-picker
          [options]="placeCombobox()"
          [value]="placeIds()"
          placeholder="Search places…"
          emptyMessage="No places in this universe yet."
          (valueChange)="onPlaceIds($event)"
        />
      </div>

      <div class="field">
        <app-in-game-date-input
          label="In-game date"
          [value]="m.inGameDate"
          (valueChanged)="onDate($event)"
        />
      </div>

      <div class="field checkbox">
        <label>
          <input type="checkbox" [checked]="m.draft" (change)="onDraft($event)" />
          Draft (hidden from catalog)
        </label>
      </div>
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
      color: #4b5563;
    }
    .hint {
      font-size: 0.75rem;
      color: #6b7280;
    }
    .error {
      font-size: 0.75rem;
      color: #b00020;
    }
    input[type='text'],
    textarea {
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      font: inherit;
    }
    input[type='text'].invalid {
      border-color: #b00020;
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
      border: 1px solid #e5e7eb;
      background: #f3f4f6;
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
  readonly storyId = input<string>('');
  readonly characterOptions = input<EntityPickerOption[]>([]);
  readonly placeOptions = input<EntityPickerOption[]>([]);
  readonly inlineRefOptions = input<InlineRefOption[]>([]);
  readonly update = output<Partial<StoryMeta>>();

  private readonly assets = inject(StoryAssetsService);

  protected readonly busy = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  protected readonly slugValid = computed(() => {
    const m = this.meta();
    if (!m) return true;
    return SLUG_PATTERN.test(m.slug);
  });

  protected readonly characterCombobox = computed<ComboboxOption[]>(() =>
    this.characterOptions().map((o) => ({ id: o.id, label: o.label, hint: o.slug })),
  );
  protected readonly placeCombobox = computed<ComboboxOption[]>(() =>
    this.placeOptions().map((o) => ({ id: o.id, label: o.label, hint: o.slug })),
  );
  protected readonly characterIds = computed(() => this.meta()?.mainCharacters.map((r) => r.id) ?? []);
  protected readonly placeIds = computed(() => this.meta()?.places.map((r) => r.id) ?? []);

  protected onTitle(event: Event): void {
    this.update.emit({ title: (event.target as HTMLInputElement).value });
  }

  protected onSlug(event: Event): void {
    this.update.emit({ slug: (event.target as HTMLInputElement).value });
  }

  protected onSummary(value: string): void {
    this.update.emit({ summary: value || undefined });
  }

  protected onCharacterIds(ids: string[]): void {
    this.update.emit({
      mainCharacters: ids.map((id) => ({ kind: 'character', id })),
    });
  }

  protected onPlaceIds(ids: string[]): void {
    this.update.emit({
      places: ids.map((id) => ({ kind: 'place', id })),
    });
  }

  protected onDate(value: InGameDate): void {
    this.update.emit({ inGameDate: value });
  }

  protected onDraft(event: Event): void {
    this.update.emit({ draft: (event.target as HTMLInputElement).checked });
  }

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const id = this.storyId();
    if (!id) return;

    this.busy.set(true);
    this.uploadError.set(null);
    try {
      const url = await this.assets.uploadCover(id, file);
      this.update.emit({ coverImage: url });
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected clearCover(): void {
    this.update.emit({ coverImage: undefined });
  }
}
