import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CharactersService } from '@features/characters';
import { CodexEntriesService } from '@features/codex';
import { CoverSlotComponent } from '@features/media';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { EntityKind, EntityRef, InGameDate, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  InGameDateInputComponent,
  PrimaryButtonComponent,
  RichTextInputComponent,
} from '@shared/ui';
import { EntityResolverService } from '@shared/data-access';
import { TimelineEventDraft } from '../data-access/event.types';

const RELATED_KIND_LABEL: Record<'character' | 'place' | 'codexEntry', string> = {
  character: 'Character',
  place: 'Place',
  codexEntry: 'Codex',
};

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
  selector: 'app-event-form',
  imports: [
    ReactiveFormsModule,
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    ComboboxPickerComponent,
    InGameDateInputComponent,
    RichTextInputComponent,
  ],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-foreground">
        {{ initial() ? 'Edit event' : 'Add event' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-foreground-muted">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
            placeholder="e.g. Calamity of the Seventh Umbral Era"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-foreground-muted">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
            placeholder="e.g. seventh-umbral-calamity"
          />
          <span class="text-xs text-foreground-faint">Lowercase, digits, hyphens. Unique within universe.</span>
        </label>
      </div>

      <app-in-game-date-input
        label="In-game date"
        [value]="inGameDate()"
        (valueChanged)="onDate($event)"
      />

      <app-cover-slot
        label="Cover image"
        [assetId]="cover()"
        (picked)="cover.set($event)"
      />

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-foreground-muted">Description</span>
        <app-rich-text-input
          [value]="description()"
          [options]="inlineRefOptions()"
          ariaLabel="Description"
          placeholder="What happens in this eventвЂ¦"
          (valueChange)="onDescription($event)"
        />
      </div>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-foreground-muted">Related entities</span>
        <app-combobox-picker
          [options]="relatedOptions()"
          [value]="relatedKeys()"
          placeholder="Search characters, places, codex entriesвЂ¦"
          emptyMessage="Nothing else in this universe yet."
          (valueChange)="onRelatedKeys($event)"
        />
      </div>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-foreground-muted">Plotlines</span>
        <app-combobox-picker
          [options]="plotlineCombobox()"
          [value]="plotlineIds()"
          placeholder="Search plotlinesвЂ¦"
          emptyMessage="No plotlines yet."
          (valueChange)="onPlotlineIds($event)"
        />
      </div>

      @if (errorMessage(); as e) {
        <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
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
  private readonly plotlinesService = inject(PlotlinesService);
  private readonly codexService = inject(CodexEntriesService);
  private readonly entityResolver = inject(EntityResolverService);

  protected readonly relatedOptions = computed<ComboboxOption[]>(() => [
    ...this.charactersService.characters().map((c) => ({
      id: refKey({ kind: 'character', id: c.id }),
      label: c.name,
      hint: RELATED_KIND_LABEL.character,
      kind: 'character' as const,
    })),
    ...this.placesService.places().map((p) => ({
      id: refKey({ kind: 'place', id: p.id }),
      label: p.name,
      hint: RELATED_KIND_LABEL.place,
      kind: 'place' as const,
    })),
    ...this.codexService.entries().map((c) => ({
      id: refKey({ kind: 'codexEntry', id: c.id }),
      label: c.title,
      hint: RELATED_KIND_LABEL.codexEntry,
      kind: 'codexEntry' as const,
    })),
  ]);

  protected readonly plotlineCombobox = computed<ComboboxOption[]>(() =>
    this.plotlinesService
      .plotlines()
      .map((p) => ({ id: p.id, label: p.title, hint: p.slug, kind: 'plotline' as const })),
  );

  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly related = signal<EntityRef[]>([]);
  protected readonly plotlineRefs = signal<EntityRef<'plotline'>[]>([]);
  protected readonly description = signal<string>('');
  protected readonly cover = signal<string | undefined>(undefined);

  protected readonly relatedKeys = computed(() => this.related().map(refKey));
  protected readonly plotlineIds = computed(() => this.plotlineRefs().map((r) => r.id));

  protected readonly inGameDate = signal<InGameDate>({});

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
      });
      this.related.set(init?.relatedRefs ?? []);
      this.plotlineRefs.set(init?.plotlineRefs ?? []);
      this.description.set(init?.description ?? '');
      this.cover.set(init?.coverAssetId);
      this.inGameDate.set(init?.inGameDate ?? {});
    });
  }

  protected onDate(value: InGameDate): void {
    this.inGameDate.set(value);
  }

  protected onRelatedKeys(keys: string[]): void {
    const refs: EntityRef[] = [];
    for (const k of keys) {
      const ref = parseRefKey(k);
      if (ref) refs.push(ref);
    }
    this.related.set(refs);
  }

  protected onPlotlineIds(ids: string[]): void {
    this.plotlineRefs.set(ids.map((id) => ({ kind: 'plotline', id })));
  }

  protected onDescription(value: string): void {
    this.description.set(value);
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const related = this.related();
    const plotlineRefs = this.plotlineRefs();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      inGameDate: this.inGameDate(),
      description: this.description().trim(),
      coverAssetId: this.cover(),
      relatedRefs: related.length > 0 ? related : undefined,
      plotlineRefs: plotlineRefs.length > 0 ? plotlineRefs : undefined,
    });
  }
}
