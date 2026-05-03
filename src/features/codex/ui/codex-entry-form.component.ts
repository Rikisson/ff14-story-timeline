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
import { FactionsService } from '@features/factions';
import { ItemsService } from '@features/items';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService } from '@features/stories';
import { EntityKind, EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { CodexEntriesService } from '../data-access/codex-entries.service';
import { CodexEntryDraft } from '../data-access/codex-entry.types';

const KIND_LABEL: Record<EntityKind, string> = {
  character: 'Character',
  place: 'Place',
  event: 'Event',
  story: 'Story',
  plotline: 'Plotline',
  item: 'Item',
  faction: 'Faction',
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
  selector: 'app-codex-entry-form',
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
        {{ initial() ? 'Edit codex entry' : 'Add codex entry' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Title</span>
          <input
            type="text"
            formControlName="title"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. The Echo"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. the-echo"
          />
          <span class="text-xs text-slate-500">Lowercase, digits, hyphens.</span>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Category</span>
          <input
            type="text"
            formControlName="category"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Magic, Religion, Race"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Body</span>
        <textarea
          formControlName="body"
          rows="8"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="The lore content of this entry."
        ></textarea>
      </label>

      <div class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Related entities</span>
        <app-combobox-picker
          [options]="relatedOptions()"
          [value]="relatedKeys()"
          placeholder="Search related characters, places, events…"
          emptyMessage="Nothing else in this universe yet."
          (valueChange)="onRelatedKeys($event)"
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
export class CodexEntryFormComponent {
  readonly initial = input<CodexEntryDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<CodexEntryDraft>();
  readonly cancelled = output<void>();

  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);
  private readonly plotlines = inject(PlotlinesService);
  private readonly items = inject(ItemsService);
  private readonly factions = inject(FactionsService);
  private readonly codex = inject(CodexEntriesService);

  protected readonly relatedOptions = computed<ComboboxOption[]>(() => [
    ...this.characters.characters().map((c) => ({
      id: refKey({ kind: 'character', id: c.id }),
      label: c.name,
      hint: KIND_LABEL.character,
      kind: 'character' as const,
    })),
    ...this.places.places().map((p) => ({
      id: refKey({ kind: 'place', id: p.id }),
      label: p.name,
      hint: KIND_LABEL.place,
      kind: 'place' as const,
    })),
    ...this.events.events().map((e) => ({
      id: refKey({ kind: 'event', id: e.id }),
      label: e.name,
      hint: KIND_LABEL.event,
      kind: 'event' as const,
    })),
    ...this.stories.publishedStories().map((s) => ({
      id: refKey({ kind: 'story', id: s.id }),
      label: s.title,
      hint: KIND_LABEL.story,
      kind: 'story' as const,
    })),
    ...this.plotlines.plotlines().map((p) => ({
      id: refKey({ kind: 'plotline', id: p.id }),
      label: p.title,
      hint: KIND_LABEL.plotline,
      kind: 'plotline' as const,
    })),
    ...this.items.items().map((i) => ({
      id: refKey({ kind: 'item', id: i.id }),
      label: i.name,
      hint: KIND_LABEL.item,
      kind: 'item' as const,
    })),
    ...this.factions.factions().map((f) => ({
      id: refKey({ kind: 'faction', id: f.id }),
      label: f.name,
      hint: KIND_LABEL.faction,
      kind: 'faction' as const,
    })),
    ...this.codex.entries().map((e) => ({
      id: refKey({ kind: 'codexEntry', id: e.id }),
      label: e.title,
      hint: KIND_LABEL.codexEntry,
      kind: 'codexEntry' as const,
    })),
  ]);

  protected readonly related = signal<EntityRef[]>([]);
  protected readonly relatedKeys = computed(() => this.related().map(refKey));

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    category: [''],
    body: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        title: init?.title ?? '',
        category: init?.category ?? '',
        body: init?.body ?? '',
      });
      this.related.set(init?.relatedRefs ?? []);
    });
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
    const category = v.category.trim();
    const refs = this.related();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      title: v.title.trim(),
      category: category || undefined,
      body: v.body.trim(),
      relatedRefs: refs.length > 0 ? refs : undefined,
    });
  }
}
