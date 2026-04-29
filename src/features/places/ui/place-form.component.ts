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
import { EventsService } from '@features/events';
import { StoriesService } from '@features/stories';
import { PlacesService } from '../data-access/places.service';
import { PlaceDraft } from '../data-access/place.types';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  GhostButtonComponent,
  PrimaryButtonComponent,
  RichTextInputComponent,
} from '@shared/ui';
import { InlineRefOption } from '@shared/utils';

@Component({
  selector: 'app-place-form',
  imports: [
    ReactiveFormsModule,
    PrimaryButtonComponent,
    GhostButtonComponent,
    RichTextInputComponent,
  ],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-slate-900">
        {{ initial() ? 'Edit place' : 'Add place' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Limsa Lominsa"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. limsa-lominsa"
          />
          <span class="text-xs text-slate-500">Lowercase letters, digits, and hyphens. Unique within this universe.</span>
        </label>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Geographical position</span>
          <input
            type="text"
            formControlName="geoPosition"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Lower La Noscea"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Factions (comma-separated)</span>
          <input
            type="text"
            formControlName="factions"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Maelstrom, Rogues' Guild"
          />
        </label>
      </div>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Description</span>
        <app-rich-text-input
          [value]="description()"
          [options]="inlineRefOptions()"
          ariaLabel="Description"
          placeholder="History, geography, notable inhabitants…"
          (valueChange)="onDescription($event)"
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
export class PlaceFormComponent {
  readonly initial = input<PlaceDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<PlaceDraft>();
  readonly cancelled = output<void>();

  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);

  protected readonly description = signal<string>('');
  protected readonly inlineRefOptions = computed<InlineRefOption[]>(() => [
    ...this.characters.characters().map((c) => ({
      kind: 'character' as const,
      id: c.id,
      label: c.name,
      slug: c.slug,
    })),
    ...this.places.places().map((p) => ({
      kind: 'place' as const,
      id: p.id,
      label: p.name,
      slug: p.slug,
    })),
    ...this.events.events().map((e) => ({
      kind: 'event' as const,
      id: e.id,
      label: e.name,
      slug: e.slug,
    })),
    ...this.stories.publishedStories().map((s) => ({
      kind: 'story' as const,
      id: s.id,
      label: s.title,
      slug: s.slug,
    })),
  ]);

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    geoPosition: ['', [Validators.required, Validators.maxLength(120)]],
    factions: [''],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
        geoPosition: init?.geoPosition ?? '',
        factions: init?.factions.join(', ') ?? '',
      });
      this.description.set(init?.description ?? '');
    });
  }

  protected onDescription(value: string): void {
    this.description.set(value);
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const desc = this.description().trim();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      geoPosition: v.geoPosition.trim(),
      factions: v.factions
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean),
      description: desc || undefined,
    });
  }
}
