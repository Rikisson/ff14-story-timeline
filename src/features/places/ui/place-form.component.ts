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
import { CodexEntriesService } from '@features/codex';
import { CoverSlotComponent } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { PlaceDraft } from '../data-access/place.types';
import { PlacesService } from '../data-access/places.service';
import { EntityResolverService } from '@shared/data-access';
import { EntityKind, EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  ComboboxOption,
  ComboboxPickerComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  RichTextInputComponent,
} from '@shared/ui';
import placeEn from '../i18n/en.json';
import placeUk from '../i18n/uk.json';

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
  selector: 'app-place-form',
  imports: [
    ReactiveFormsModule,
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    RichTextInputComponent,
    ComboboxPickerComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'place',
      loader: {
        en: () => Promise.resolve(placeEn),
        uk: () => Promise.resolve(placeUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'place'">
      <ng-container *transloco="let g; prefix: 'general'">
        <form
          [formGroup]="form"
          class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
          (ngSubmit)="onSubmit()"
        >
          <h3 class="m-0 text-base font-semibold text-foreground">
            {{ initial() ? t('field.formEdit') : t('field.formAdd') }}
          </h3>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.name') }}</span>
              <input
                type="text"
                formControlName="name"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                [placeholder]="t('empty.namePlaceholder')"
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
          </div>

          <app-cover-slot
            [label]="g('field.coverImage')"
            [assetId]="cover()"
            (picked)="cover.set($event)"
          />

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.description') }}</span>
            <app-rich-text-input
              appContentLang
              [value]="description()"
              [options]="inlineRefOptions()"
              [ariaLabel]="g('tooltip.descriptionAria')"
              [placeholder]="t('empty.descriptionPlaceholder')"
              (valueChange)="onDescription($event)"
            />
          </div>

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
export class PlaceFormComponent {
  readonly initial = input<PlaceDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<PlaceDraft>();
  readonly cancelled = output<void>();

  private readonly entityResolver = inject(EntityResolverService);
  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly codex = inject(CodexEntriesService);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly description = signal<string>('');
  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly related = signal<EntityRef[]>([]);
  protected readonly inlineRefOptions = this.entityResolver.allInlineRefOptions;

  protected readonly relatedKeys = computed(() => this.related().map(refKey));

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
