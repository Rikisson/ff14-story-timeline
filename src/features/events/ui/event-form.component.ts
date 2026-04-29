import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import { EntityPickerComponent, GhostButtonComponent, PrimaryButtonComponent } from '@shared/ui';
import { TimelineEventDraft } from '../data-access/event.types';

@Component({
  selector: 'app-event-form',
  imports: [ReactiveFormsModule, PrimaryButtonComponent, GhostButtonComponent, EntityPickerComponent],
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
          class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          placeholder="e.g. 1577 6AE"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Description</span>
        <textarea
          formControlName="description"
          rows="4"
          class="rounded-md border border-slate-300 bg-white p-3 text-sm"
          placeholder="What happens in this event…"
        ></textarea>
      </label>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Main characters</span>
          <app-entity-picker
            kind="character"
            [options]="characterOptions()"
            [value]="mainCharacters()"
            [multiple]="true"
            emptyMessage="No characters in this universe yet."
            (selected)="onCharacters($event)"
          />
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Places</span>
          <app-entity-picker
            kind="place"
            [options]="placeOptions()"
            [value]="places()"
            [multiple]="true"
            emptyMessage="No places in this universe yet."
            (selected)="onPlaces($event)"
          />
        </div>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Related dates (comma-separated)</span>
        <input
          type="text"
          formControlName="relatedDates"
          class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          placeholder="e.g. 1572 6AE, 1580 6AE"
        />
      </label>

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

  protected readonly characterOptions = computed(() =>
    this.charactersService.characters().map((c) => ({ id: c.id, label: c.name, slug: c.slug })),
  );
  protected readonly placeOptions = computed(() =>
    this.placesService.places().map((p) => ({ id: p.id, label: p.name, slug: p.slug })),
  );

  protected readonly mainCharacters = signal<EntityRef<'character'>[]>([]);
  protected readonly places = signal<EntityRef<'place'>[]>([]);

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    inGameDate: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(2000)]],
    relatedDates: [''],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
        inGameDate: init?.inGameDate ?? '',
        description: init?.description ?? '',
        relatedDates: init?.relatedDates.join(', ') ?? '',
      });
      this.mainCharacters.set(init?.mainCharacters ?? []);
      this.places.set(init?.places ?? []);
    });
  }

  protected onCharacters(refs: EntityRef[]): void {
    this.mainCharacters.set(refs as EntityRef<'character'>[]);
  }

  protected onPlaces(refs: EntityRef[]): void {
    this.places.set(refs as EntityRef<'place'>[]);
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      inGameDate: v.inGameDate.trim(),
      description: v.description.trim(),
      mainCharacters: this.mainCharacters(),
      places: this.places(),
      relatedDates: splitCsv(v.relatedDates),
    });
  }
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
