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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CharactersService } from '@features/characters';
import { CoverSlotComponent } from '@features/media';
import { PlacesService } from '@features/places';
import { EntityKind, EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import { CodexEntriesService } from '../data-access/codex-entries.service';
import { CodexEntryDraft } from '../data-access/codex-entry.types';
import codexEn from '../i18n/en.json';
import codexUk from '../i18n/uk.json';

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
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    ComboboxPickerComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'codex',
      loader: {
        en: () => Promise.resolve(codexEn),
        uk: () => Promise.resolve(codexUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'codex'">
      <ng-container *transloco="let g; prefix: 'general'">
        <form
          [formGroup]="form"
          class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
          (ngSubmit)="onSubmit()"
        >
          <h3 class="m-0 text-base font-semibold text-foreground">
            {{ initial() ? t('field.formEdit') : t('field.formAdd') }}
          </h3>

          <div class="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.title') }}</span>
              <input
                type="text"
                formControlName="title"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                [placeholder]="t('empty.titlePlaceholder')"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.slug') }}</span>
              <input
                type="text"
                formControlName="slug"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                [placeholder]="t('empty.slugPlaceholder')"
              />
              <span class="text-xs text-foreground-faint">{{ g('message.slugHint') }}</span>
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ t('field.category') }}</span>
              <input
                type="text"
                formControlName="category"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                list="codex-category-options"
                [placeholder]="t('empty.categoryPlaceholder')"
              />
              <datalist id="codex-category-options">
                @for (cat of categoryOptions(); track cat.id) {
                  <option [value]="cat.label"></option>
                }
              </datalist>
            </label>
          </div>

          <app-cover-slot
            [label]="g('field.coverImage')"
            [assetId]="cover()"
            (picked)="cover.set($event)"
          />

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.description') }}</span>
            <textarea
              formControlName="description"
              rows="8"
              class="rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 py-2 text-sm"
              [placeholder]="t('empty.descriptionPlaceholder')"
            ></textarea>
          </label>

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.relatedEntities') }}</span>
            <app-combobox-picker
              [options]="relatedOptions()"
              [value]="relatedKeys()"
              [placeholder]="g('empty.searchRelated')"
              [emptyMessage]="g('empty.noRelatedAvailable')"
              (valueChange)="onRelatedKeys($event)"
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
              {{ initial() ? g('action.save') : g('action.add') }}
            </button>
            <button uiGhost type="button" (click)="cancelled.emit()">{{ g('action.cancel') }}</button>
          </div>
        </form>
      </ng-container>
    </ng-container>
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
  private readonly codex = inject(CodexEntriesService);
  private readonly categoriesService = inject(CodexCategoriesService);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly categoryOptions = this.categoriesService.categories;

  private readonly relatedKindLabels = computed<Record<'character' | 'place' | 'codexEntry', string>>(
    () => {
      this.activeLang();
      return {
        character: this.transloco.translate('general.field.relatedKindCharacter'),
        place: this.transloco.translate('general.field.relatedKindPlace'),
        codexEntry: this.transloco.translate('general.field.relatedKindCodex'),
      };
    },
  );

  protected readonly relatedOptions = computed<ComboboxOption[]>(() => {
    const labels = this.relatedKindLabels();
    return [
      ...this.characters.characters().map((c) => ({
        id: refKey({ kind: 'character', id: c.id }),
        label: c.name,
        hint: labels.character,
        kind: 'character' as const,
      })),
      ...this.places.places().map((p) => ({
        id: refKey({ kind: 'place', id: p.id }),
        label: p.name,
        hint: labels.place,
        kind: 'place' as const,
      })),
      ...this.codex.entries().map((e) => ({
        id: refKey({ kind: 'codexEntry', id: e.id }),
        label: e.title,
        hint: labels.codexEntry,
        kind: 'codexEntry' as const,
      })),
    ];
  });

  protected readonly related = signal<EntityRef[]>([]);
  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly relatedKeys = computed(() => this.related().map(refKey));

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    category: [''],
    description: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        title: init?.title ?? '',
        category: init?.category ?? '',
        description: init?.description ?? '',
      });
      this.related.set(init?.relatedRefs ?? []);
      this.cover.set(init?.coverAssetId);
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
    const typedCategory = v.category.trim();
    const matched = typedCategory
      ? this.categoriesService.categoryByLabel().get(typedCategory.toLowerCase())
      : undefined;
    const category = matched?.label ?? (typedCategory || undefined);
    const refs = this.related();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      title: v.title.trim(),
      category,
      description: v.description.trim(),
      coverAssetId: this.cover(),
      relatedRefs: refs.length > 0 ? refs : undefined,
    });
  }
}
