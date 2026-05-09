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
import { CodexEntriesService } from '@features/codex';
import { CoverSlotComponent } from '@features/media';
import { PlacesService } from '@features/places';
import { CharacterDraft } from '../data-access/character.types';
import { CharactersService } from '../data-access/characters.service';
import { EntityResolverService } from '@shared/data-access';
import { EntityKind, EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  RichTextInputComponent,
} from '@shared/ui';

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
  selector: 'app-character-form',
  imports: [
    ReactiveFormsModule,
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    RichTextInputComponent,
    ComboboxPickerComponent,
  ],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
        {{ initial() ? 'Edit character' : 'Add character' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm"
            placeholder="e.g. Y'shtola"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm"
            placeholder="e.g. yshtola"
          />
          <span class="text-xs text-slate-500 dark:text-slate-400">Lowercase letters, digits, and hyphens. Unique within this universe.</span>
        </label>
      </div>

      <app-cover-slot
        label="Cover image"
        [assetId]="cover()"
        (picked)="cover.set($event)"
      />

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700 dark:text-slate-300">Description</span>
        <app-rich-text-input
          [value]="description()"
          [options]="inlineRefOptions()"
          ariaLabel="Description"
          placeholder="Background, personality, ties to other characters…"
          (valueChange)="onDescription($event)"
        />
      </div>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700 dark:text-slate-300">Related entities</span>
        <app-combobox-picker
          [options]="relatedOptions()"
          [value]="relatedKeys()"
          placeholder="Search characters, places, codex entries…"
          emptyMessage="Nothing else in this universe yet."
          (valueChange)="onRelatedKeys($event)"
        />
      </div>

      @if (errorMessage(); as e) {
        <p class="m-0 text-sm text-red-700 dark:text-red-400">{{ e }}</p>
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
export class CharacterFormComponent {
  readonly initial = input<CharacterDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<CharacterDraft>();
  readonly cancelled = output<void>();

  private readonly entityResolver = inject(EntityResolverService);
  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly codex = inject(CodexEntriesService);

  protected readonly description = signal<string>('');
  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly related = signal<EntityRef[]>([]);
  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly relatedKeys = computed(() => this.related().map(refKey));

  protected readonly relatedOptions = computed<ComboboxOption[]>(() => [
    ...this.characters.characters().map((c) => ({
      id: refKey({ kind: 'character', id: c.id }),
      label: c.name,
      hint: RELATED_KIND_LABEL.character,
      kind: 'character' as const,
    })),
    ...this.places.places().map((p) => ({
      id: refKey({ kind: 'place', id: p.id }),
      label: p.name,
      hint: RELATED_KIND_LABEL.place,
      kind: 'place' as const,
    })),
    ...this.codex.entries().map((e) => ({
      id: refKey({ kind: 'codexEntry', id: e.id }),
      label: e.title,
      hint: RELATED_KIND_LABEL.codexEntry,
      kind: 'codexEntry' as const,
    })),
  ]);

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        name: init?.name ?? '',
      });
      this.description.set(init?.description ?? '');
      this.cover.set(init?.coverAssetId);
      this.related.set(init?.relatedRefs ?? []);
    });
  }

  protected onDescription(value: string): void {
    this.description.set(value);
  }

  protected onRelatedKeys(keys: string[]): void {
    const refs: EntityRef[] = [];
    for (const k of keys) {
      const ref = parseRefKey(k);
      if (ref) refs.push(ref);
    }
    this.related.set(refs);
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const desc = this.description().trim();
    const refs = this.related();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      description: desc || undefined,
      coverAssetId: this.cover(),
      relatedRefs: refs.length > 0 ? refs : undefined,
    });
  }
}
