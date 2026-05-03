import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CharactersService } from '@features/characters';
import { FactionsService } from '@features/factions';
import { ItemsService } from '@features/items';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService } from '@features/stories';
import { EntityRef, InGameDate, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  InGameDateInputComponent,
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
    InGameDateInputComponent,
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

      <div class="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
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
          <span class="text-xs text-slate-500">Lowercase, digits, hyphens. Unique within universe.</span>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Type</span>
          <input
            type="text"
            formControlName="type"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Battle, Treaty, Cataclysm"
          />
        </label>
      </div>

      <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
        <app-in-game-date-input
          label="In-game date"
          [value]="inGameDate()"
          (valueChanged)="onDate($event)"
        />
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Sort order</span>
          <input
            type="number"
            formControlName="sortOrder"
            class="h-10 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="0"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Summary</span>
        <textarea
          formControlName="summary"
          rows="2"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="One-line headline shown in lists."
        ></textarea>
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

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Consequences</span>
        <textarea
          formControlName="consequences"
          rows="3"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="What changes after this event."
        ></textarea>
      </label>

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

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Related events</span>
          <app-combobox-picker
            [options]="eventCombobox()"
            [value]="relatedEventIds()"
            placeholder="Search events…"
            emptyMessage="No other events yet."
            (valueChange)="onRelatedEventIds($event)"
          />
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Plotlines</span>
          <app-combobox-picker
            [options]="plotlineCombobox()"
            [value]="plotlineIds()"
            placeholder="Search plotlines…"
            emptyMessage="No plotlines yet."
            (valueChange)="onPlotlineIds($event)"
          />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Items</span>
          <app-combobox-picker
            [options]="itemCombobox()"
            [value]="itemIds()"
            placeholder="Search items…"
            emptyMessage="No items yet."
            (valueChange)="onItemIds($event)"
          />
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Factions</span>
          <app-combobox-picker
            [options]="factionCombobox()"
            [value]="factionIds()"
            placeholder="Search factions…"
            emptyMessage="No factions yet."
            (valueChange)="onFactionIds($event)"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Related dates</span>
        <app-combobox-picker
          [options]="[]"
          [value]="relatedDates()"
          [allowCreate]="true"
          placeholder="Type a date label…"
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
  readonly submitted = output<TimelineEventDraft>();
  readonly cancelled = output<void>();

  private readonly charactersService = inject(CharactersService);
  private readonly placesService = inject(PlacesService);
  private readonly eventsService = inject(EventsService);
  private readonly storiesService = inject(StoriesService);
  private readonly plotlinesService = inject(PlotlinesService);
  private readonly itemsService = inject(ItemsService);
  private readonly factionsService = inject(FactionsService);

  protected readonly characterCombobox = computed<ComboboxOption[]>(() =>
    this.charactersService
      .characters()
      .map((c) => ({ id: c.id, label: c.name, hint: c.slug, kind: 'character' as const })),
  );
  protected readonly placeCombobox = computed<ComboboxOption[]>(() =>
    this.placesService
      .places()
      .map((p) => ({ id: p.id, label: p.name, hint: p.slug, kind: 'place' as const })),
  );
  protected readonly eventCombobox = computed<ComboboxOption[]>(() =>
    this.eventsService
      .events()
      .map((e) => ({ id: e.id, label: e.name, hint: e.slug, kind: 'event' as const })),
  );
  protected readonly plotlineCombobox = computed<ComboboxOption[]>(() =>
    this.plotlinesService
      .plotlines()
      .map((p) => ({ id: p.id, label: p.title, hint: p.slug, kind: 'plotline' as const })),
  );
  protected readonly itemCombobox = computed<ComboboxOption[]>(() =>
    this.itemsService
      .items()
      .map((i) => ({ id: i.id, label: i.name, hint: i.slug, kind: 'item' as const })),
  );
  protected readonly factionCombobox = computed<ComboboxOption[]>(() =>
    this.factionsService
      .factions()
      .map((f) => ({ id: f.id, label: f.name, hint: f.slug, kind: 'faction' as const })),
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
  protected readonly relatedEvents = signal<EntityRef<'event'>[]>([]);
  protected readonly plotlineRefs = signal<EntityRef<'plotline'>[]>([]);
  protected readonly itemRefs = signal<EntityRef<'item'>[]>([]);
  protected readonly factionRefs = signal<EntityRef<'faction'>[]>([]);
  protected readonly relatedDates = signal<string[]>([]);
  protected readonly description = signal<string>('');

  protected readonly characterIds = computed(() => this.mainCharacters().map((r) => r.id));
  protected readonly placeIds = computed(() => this.places().map((r) => r.id));
  protected readonly relatedEventIds = computed(() => this.relatedEvents().map((r) => r.id));
  protected readonly plotlineIds = computed(() => this.plotlineRefs().map((r) => r.id));
  protected readonly itemIds = computed(() => this.itemRefs().map((r) => r.id));
  protected readonly factionIds = computed(() => this.factionRefs().map((r) => r.id));

  protected readonly inGameDate = signal<InGameDate>({});

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    type: ['', [Validators.maxLength(60)]],
    summary: ['', [Validators.maxLength(280)]],
    sortOrder: [null as number | null],
    consequences: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
        type: init?.type ?? '',
        summary: init?.summary ?? '',
        sortOrder: init?.sortOrder ?? null,
        consequences: init?.consequences ?? '',
      });
      this.mainCharacters.set(init?.mainCharacters ?? []);
      this.places.set(init?.places ?? []);
      this.relatedEvents.set(init?.relatedEvents ?? []);
      this.plotlineRefs.set(init?.plotlineRefs ?? []);
      this.itemRefs.set(init?.itemRefs ?? []);
      this.factionRefs.set(init?.factionRefs ?? []);
      this.relatedDates.set(init?.relatedDates ?? []);
      this.description.set(init?.description ?? '');
      this.inGameDate.set(init?.inGameDate ?? {});
    });
  }

  protected onDate(value: InGameDate): void {
    this.inGameDate.set(value);
  }

  protected onCharacterIds(ids: string[]): void {
    this.mainCharacters.set(ids.map((id) => ({ kind: 'character', id })));
  }

  protected onPlaceIds(ids: string[]): void {
    this.places.set(ids.map((id) => ({ kind: 'place', id })));
  }

  protected onRelatedEventIds(ids: string[]): void {
    this.relatedEvents.set(ids.map((id) => ({ kind: 'event', id })));
  }

  protected onPlotlineIds(ids: string[]): void {
    this.plotlineRefs.set(ids.map((id) => ({ kind: 'plotline', id })));
  }

  protected onItemIds(ids: string[]): void {
    this.itemRefs.set(ids.map((id) => ({ kind: 'item', id })));
  }

  protected onFactionIds(ids: string[]): void {
    this.factionRefs.set(ids.map((id) => ({ kind: 'faction', id })));
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
    const type = v.type.trim();
    const summary = v.summary.trim();
    const consequences = v.consequences.trim();
    const relatedEvents = this.relatedEvents();
    const plotlineRefs = this.plotlineRefs();
    const itemRefs = this.itemRefs();
    const factionRefs = this.factionRefs();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      inGameDate: this.inGameDate(),
      description: this.description().trim(),
      mainCharacters: this.mainCharacters(),
      places: this.places(),
      relatedDates: this.relatedDates(),
      type: type || undefined,
      summary: summary || undefined,
      sortOrder: v.sortOrder == null ? undefined : v.sortOrder,
      consequences: consequences || undefined,
      relatedEvents: relatedEvents.length > 0 ? relatedEvents : undefined,
      plotlineRefs: plotlineRefs.length > 0 ? plotlineRefs : undefined,
      itemRefs: itemRefs.length > 0 ? itemRefs : undefined,
      factionRefs: factionRefs.length > 0 ? factionRefs : undefined,
    });
  }
}
