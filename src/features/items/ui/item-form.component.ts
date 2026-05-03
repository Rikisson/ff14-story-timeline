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
import { ItemDraft } from '../data-access/item.types';

@Component({
  selector: 'app-item-form',
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
        {{ initial() ? 'Edit item' : 'Add item' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Crystal of Light"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. crystal-of-light"
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
            placeholder="e.g. Artifact, Weapon, Key"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Image URL</span>
          <input
            type="url"
            formControlName="image"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="https://…"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Description</span>
        <textarea
          formControlName="description"
          rows="4"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="What is this item, who uses it, what does it do…"
        ></textarea>
      </label>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Owner</span>
          <select
            formControlName="ownerId"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">— None —</option>
            @for (c of characterOptions(); track c.id) {
              <option [value]="c.id">{{ c.label }}</option>
            }
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Current place</span>
          <select
            formControlName="placeId"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">— None —</option>
            @for (p of placeOptions(); track p.id) {
              <option [value]="p.id">{{ p.label }}</option>
            }
          </select>
        </label>
      </div>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Related characters</span>
        <app-combobox-picker
          [options]="characterOptions()"
          [value]="relatedCharIds()"
          placeholder="Search characters…"
          emptyMessage="No characters in this universe yet."
          (valueChange)="onRelatedCharIds($event)"
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
export class ItemFormComponent {
  readonly initial = input<ItemDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<ItemDraft>();
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

  protected readonly relatedChars = signal<EntityRef<'character'>[]>([]);
  protected readonly relatedCharIds = computed(() => this.relatedChars().map((r) => r.id));

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    type: [''],
    image: [''],
    description: [''],
    ownerId: [''],
    placeId: [''],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
        type: init?.type ?? '',
        image: init?.image ?? '',
        description: init?.description ?? '',
        ownerId: init?.owner?.id ?? '',
        placeId: init?.place?.id ?? '',
      });
      this.relatedChars.set(init?.relatedCharacters ?? []);
    });
  }

  protected onRelatedCharIds(ids: string[]): void {
    this.relatedChars.set(ids.map((id) => ({ kind: 'character', id })));
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const type = v.type.trim();
    const image = v.image.trim();
    const description = v.description.trim();
    const owner: EntityRef<'character'> | undefined = v.ownerId
      ? { kind: 'character', id: v.ownerId }
      : undefined;
    const place: EntityRef<'place'> | undefined = v.placeId
      ? { kind: 'place', id: v.placeId }
      : undefined;
    const related = this.relatedChars();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      type: type || undefined,
      image: image || undefined,
      description: description || undefined,
      owner,
      place,
      relatedCharacters: related.length > 0 ? related : undefined,
    });
  }
}
