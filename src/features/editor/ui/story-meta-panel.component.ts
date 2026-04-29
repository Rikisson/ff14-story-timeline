import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SLUG_PATTERN } from '@shared/models';
import { StoryMeta } from '../data-access/editor.state';

@Component({
  selector: 'app-story-meta-panel',
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
        <label for="meta-summary">Summary</label>
        <textarea
          id="meta-summary"
          rows="3"
          [value]="m.summary ?? ''"
          (input)="onSummary($event)"
        ></textarea>
      </div>

      <div class="field">
        <label for="meta-characters">Main characters (comma-separated)</label>
        <input
          id="meta-characters"
          type="text"
          [value]="m.mainCharacters.join(', ')"
          (input)="onCharacters($event)"
        />
      </div>

      <div class="field">
        <label for="meta-places">Places (comma-separated)</label>
        <input
          id="meta-places"
          type="text"
          [value]="m.places.join(', ')"
          (input)="onPlaces($event)"
        />
      </div>

      <div class="field">
        <label for="meta-date">In-game date</label>
        <input id="meta-date" type="text" [value]="m.inGameDate" (input)="onDate($event)" />
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryMetaPanelComponent {
  readonly meta = input.required<StoryMeta | null>();
  readonly update = output<Partial<StoryMeta>>();

  protected readonly slugValid = computed(() => {
    const m = this.meta();
    if (!m) return true;
    return SLUG_PATTERN.test(m.slug);
  });

  protected onTitle(event: Event): void {
    this.update.emit({ title: (event.target as HTMLInputElement).value });
  }

  protected onSlug(event: Event): void {
    this.update.emit({ slug: (event.target as HTMLInputElement).value });
  }

  protected onSummary(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.update.emit({ summary: value || undefined });
  }

  protected onCharacters(event: Event): void {
    this.update.emit({ mainCharacters: this.parseCsv(event) });
  }

  protected onPlaces(event: Event): void {
    this.update.emit({ places: this.parseCsv(event) });
  }

  protected onDate(event: Event): void {
    this.update.emit({ inGameDate: (event.target as HTMLInputElement).value });
  }

  protected onDraft(event: Event): void {
    this.update.emit({ draft: (event.target as HTMLInputElement).checked });
  }

  private parseCsv(event: Event): string[] {
    return (event.target as HTMLInputElement).value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
