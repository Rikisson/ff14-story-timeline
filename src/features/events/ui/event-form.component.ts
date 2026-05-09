import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { DateValidationError } from '@features/calendar';
import { CharactersService } from '@features/characters';
import { CodexEntriesService } from '@features/codex';
import { CoverSlotComponent } from '@features/media';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { ContentLangDirective } from '@features/universes';
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
import eventEn from '../i18n/en.json';
import eventUk from '../i18n/uk.json';

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
    TranslocoDirective,
    ContentLangDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'event',
      loader: {
        en: () => Promise.resolve(eventEn),
        uk: () => Promise.resolve(eventUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'event'">
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

          <app-in-game-date-input
            [label]="t('field.inGameDate')"
            [value]="inGameDate()"
            (valueChanged)="onDate($event)"
            (errorsChanged)="dateErrors.set($event)"
          />

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

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.plotlines') }}</span>
            <app-combobox-picker
              [options]="plotlineCombobox()"
              [value]="plotlineIds()"
              [placeholder]="g('empty.searchPlotlines')"
              [emptyMessage]="g('empty.noPlotlines')"
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
              [disabled]="form.invalid || dateErrors().length > 0 || busy()"
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
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

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
      ...this.charactersService.characters().map((c) => ({
        id: refKey({ kind: 'character', id: c.id }),
        label: c.name,
        hint: labels.character,
        kind: 'character' as const,
      })),
      ...this.placesService.places().map((p) => ({
        id: refKey({ kind: 'place', id: p.id }),
        label: p.name,
        hint: labels.place,
        kind: 'place' as const,
      })),
      ...this.codexService.entries().map((c) => ({
        id: refKey({ kind: 'codexEntry', id: c.id }),
        label: c.title,
        hint: labels.codexEntry,
        kind: 'codexEntry' as const,
      })),
    ];
  });

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
  protected readonly dateErrors = signal<DateValidationError[]>([]);

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
