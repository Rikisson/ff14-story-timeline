import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { StoriesService } from '@features/stories';
import { EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  RichTextInputComponent,
} from '@shared/ui';
import { InlineRefOption } from '@shared/utils';
import { EventsService } from '../data-access/events.service';
import { TimelineEventDraft } from '../data-access/event.types';

@Component({
  selector: 'app-event-form',
  imports: [
    ReactiveFormsModule,
    PrimaryButtonComponent,
    GhostButtonComponent,
    ComboboxPickerComponent,
    RichTextInputComponent,
  ],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-slate-900">
        {{ initial() ? 'Edit event' : 'Add event' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Calamity of the Seventh Umbral Era"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. seventh-umbral-calamity"
          />
          <span class="text-xs text-slate-500">Lowercase letters, digits, and hyphens. Unique within this universe.</span>
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">In-game date</span>
        <input
          type="text"
          formControlName="inGameDate"
          list="event-date-suggestions"
          autocomplete="off"
          class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          placeholder="Year 1, Spring of the Wolf, 1577 6AE…"
        />
        <datalist id="event-date-suggestions">
          @for (d of dateSuggestions(); track d) {
            <option [value]="d"></option>
          }
        </datalist>
      </label>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Description</span>
        <app-rich-text-input
          [value]="description()"
          [options]="inlineRefOptions()"
          ariaLabel="Description"
          placeholder="What happens in this event…"
          (valueChange)="onDescription($event)"
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Main characters</span>
          <app-combobox-picker
            [options]="characterCombobox()"
            [value]="characterIds()"
            placeholder="Search characters…"
            emptyMessage="No characters in this universe yet."
            (valueChange)="onCharacterIds($event)"
          />
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Places</span>
          <app-combobox-picker
            [options]="placeCombobox()"
            [value]="placeIds()"
            placeholder="Search places…"
            emptyMessage="No places in this universe yet."
            (valueChange)="onPlaceIds($event)"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Related dates</span>
        <app-combobox-picker
          [options]="dateCombobox()"
          [value]="relatedDates()"
          [allowCreate]="true"
          placeholder="Pick or type a date…"
          emptyMessage="No dates yet — type one to add."
          (valueChange)="onRelatedDates($event)"
        />
      </div>

      @if (errorMessage(); as e) {
        <p class="m-0 text-sm text-red-700">{{ e }}</p>
      }

      <div class="flex gap-2">
        <button
          uiPrimary
          type="submit"
          [loading]="busy()"
          [disabled]="form.invalid || busy()"
        >
          {{ initial() ? 'Save' : 'Add' }}
        </button>
        <button uiGhost type="button" (click)="cancelled.emit()">Cancel</button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventFormComponent {
  readonly initial = input<TimelineEventDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly dateSuggestions = input<string[]>([]);
  readonly submitted = output<TimelineEventDraft>();
  readonly cancelled = output<void>();

  private readonly charactersService = inject(CharactersService);
  private readonly placesService = inject(PlacesService);
  private readonly eventsService = inject(EventsService);
  private readonly storiesService = inject(StoriesService);

  protected readonly characterCombobox = computed<ComboboxOption[]>(() =>
    this.charactersService
      .characters()
      .map((c) => ({ id: c.id, label: c.name, hint: c.slug })),
  );
  protected readonly placeCombobox = computed<ComboboxOption[]>(() =>
    this.placesService.places().map((p) => ({ id: p.id, label: p.name, hint: p.slug })),
  );
  protected readonly dateCombobox = computed<ComboboxOption[]>(() =>
    this.dateSuggestions().map((d) => ({ id: d, label: d })),
  );
  protected readonly inlineRefOptions = computed<InlineRefOption[]>(() => [
    ...this.charactersService.characters().map((c) => ({
      kind: 'character' as const,
      id: c.id,
      label: c.name,
      slug: c.slug,
    })),
    ...this.placesService.places().map((p) => ({
      kind: 'place' as const,
      id: p.id,
      label: p.name,
      slug: p.slug,
    })),
    ...this.eventsService.events().map((e) => ({
      kind: 'event' as const,
      id: e.id,
      label: e.name,
      slug: e.slug,
    })),
    ...this.storiesService.publishedStories().map((s) => ({
      kind: 'story' as const,
      id: s.id,
      label: s.title,
      slug: s.slug,
    })),
  ]);

  protected readonly mainCharacters = signal<EntityRef<'character'>[]>([]);
  protected readonly places = signal<EntityRef<'place'>[]>([]);
  protected readonly relatedDates = signal<string[]>([]);
  protected readonly description = signal<string>('');

  protected readonly characterIds = computed(() => this.mainCharacters().map((r) => r.id));
  protected readonly placeIds = computed(() => this.places().map((r) => r.id));

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    inGameDate: ['', [Validators.required, Validators.maxLength(80)]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
        inGameDate: init?.inGameDate ?? '',
      });
      this.mainCharacters.set(init?.mainCharacters ?? []);
      this.places.set(init?.places ?? []);
      this.relatedDates.set(init?.relatedDates ?? []);
      this.description.set(init?.description ?? '');
    });
  }

  protected onCharacterIds(ids: string[]): void {
    this.mainCharacters.set(ids.map((id) => ({ kind: 'character', id })));
  }

  protected onPlaceIds(ids: string[]): void {
    this.places.set(ids.map((id) => ({ kind: 'place', id })));
  }

  protected onRelatedDates(dates: string[]): void {
    this.relatedDates.set(dates);
  }

  protected onDescription(value: string): void {
    this.description.set(value);
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      inGameDate: v.inGameDate.trim(),
      description: this.description().trim(),
      mainCharacters: this.mainCharacters(),
      places: this.places(),
      relatedDates: this.relatedDates(),
    });
  }
}
