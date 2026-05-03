import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { FactionDraft } from '../data-access/faction.types';

@Component({
  selector: 'app-faction-form',
  imports: [
    ReactiveFormsModule,
    PrimaryButtonComponent,
    GhostButtonComponent,
    ComboboxPickerComponent,
  ],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-slate-900">
        {{ initial() ? 'Edit faction' : 'Add faction' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. The Maelstrom"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. the-maelstrom"
          />
          <span class="text-xs text-slate-500">Lowercase letters, digits, and hyphens. Unique within this universe.</span>
        </label>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Type</span>
          <input
            type="text"
            formControlName="type"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Grand Company, Clan, Order"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Headquarters</span>
          <select
            formControlName="hqId"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">— None —</option>
            @for (p of placeOptions(); track p.id) {
              <option [value]="p.id">{{ p.label }}</option>
            }
          </select>
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Description</span>
        <textarea
          formControlName="description"
          rows="4"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="History, ideology, allegiances…"
        ></textarea>
      </label>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Notable members</span>
          <app-combobox-picker
            [options]="characterOptions()"
            [value]="memberIds()"
            placeholder="Search characters…"
            emptyMessage="No characters in this universe yet."
            (valueChange)="onMemberIds($event)"
          />
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Related places</span>
          <app-combobox-picker
            [options]="placeOptions()"
            [value]="placeIds()"
            placeholder="Search places…"
            emptyMessage="No places in this universe yet."
            (valueChange)="onPlaceIds($event)"
          />
        </div>
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
export class FactionFormComponent {
  readonly initial = input<FactionDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<FactionDraft>();
  readonly cancelled = output<void>();

  private readonly charactersService = inject(CharactersService);
  private readonly placesService = inject(PlacesService);

  protected readonly characterOptions = computed<ComboboxOption[]>(() =>
    this.charactersService
      .characters()
      .map((c) => ({ id: c.id, label: c.name, hint: c.slug, kind: 'character' as const })),
  );
  protected readonly placeOptions = computed<ComboboxOption[]>(() =>
    this.placesService
      .places()
      .map((p) => ({ id: p.id, label: p.name, hint: p.slug, kind: 'place' as const })),
  );

  protected readonly members = signal<EntityRef<'character'>[]>([]);
  protected readonly relatedPlaces = signal<EntityRef<'place'>[]>([]);
  protected readonly memberIds = computed(() => this.members().map((r) => r.id));
  protected readonly placeIds = computed(() => this.relatedPlaces().map((r) => r.id));

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    type: [''],
    hqId: [''],
    description: [''],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
        type: init?.type ?? '',
        hqId: init?.headquarters?.id ?? '',
        description: init?.description ?? '',
      });
      this.members.set(init?.relatedCharacters ?? []);
      this.relatedPlaces.set(init?.relatedPlaces ?? []);
    });
  }

  protected onMemberIds(ids: string[]): void {
    this.members.set(ids.map((id) => ({ kind: 'character', id })));
  }

  protected onPlaceIds(ids: string[]): void {
    this.relatedPlaces.set(ids.map((id) => ({ kind: 'place', id })));
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const type = v.type.trim();
    const description = v.description.trim();
    const hq: EntityRef<'place'> | undefined = v.hqId
      ? { kind: 'place', id: v.hqId }
      : undefined;
    const members = this.members();
    const places = this.relatedPlaces();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      type: type || undefined,
      description: description || undefined,
      headquarters: hq,
      relatedCharacters: members.length > 0 ? members : undefined,
      relatedPlaces: places.length > 0 ? places : undefined,
    });
  }
}
