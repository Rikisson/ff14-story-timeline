import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { DateValidationError } from '@features/calendar';
import { CoverSlotComponent } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { EntityRef, InGameDate, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  EntityPickerComponent,
  GhostButtonComponent,
  InGameDateInputComponent,
  PrimaryButtonComponent,
  RichTextInputComponent,
} from '@shared/ui';
import { TimelineEventDraft } from '../data-access/event.types';
import eventEn from '../i18n/en.json';
import eventUk from '../i18n/uk.json';

/** Per `docs/backend-rules.md` *Cardinality limits*. */
const RELATED_REFS_MAX = 50;
const PLOTLINE_REFS_MAX = 10;

@Component({
  selector: 'app-event-form',
  imports: [
    ReactiveFormsModule,
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    EntityPickerComponent,
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
              [ariaLabel]="g('tooltip.descriptionAria')"
              [placeholder]="t('empty.descriptionPlaceholder')"
              (valueChange)="onDescription($event)"
            />
          </div>

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.relatedEntities') }}</span>
            <app-entity-picker
              [value]="related()"
              [kinds]="relatedKinds"
              [maxSelections]="relatedMax"
              [placeholder]="g('empty.searchRelated')"
              (valueChange)="related.set($event)"
            />
          </div>

          <div class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.plotlines') }}</span>
            <app-entity-picker
              [value]="plotlineValue()"
              [kinds]="plotlineKinds"
              [maxSelections]="plotlineMax"
              [placeholder]="g('empty.searchPlotlines')"
              (valueChange)="onPlotlineRefs($event)"
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

  protected readonly relatedKinds = ['character', 'place', 'codexEntry'] as const;
  protected readonly relatedMax = RELATED_REFS_MAX;
  protected readonly plotlineKinds = ['plotline'] as const;
  protected readonly plotlineMax = PLOTLINE_REFS_MAX;

  protected readonly related = signal<EntityRef[]>([]);
  protected readonly plotlineRefs = signal<EntityRef<'plotline'>[]>([]);
  protected readonly description = signal<string>('');
  protected readonly cover = signal<string | undefined>(undefined);

  protected readonly plotlineValue = computed<EntityRef[]>(() => this.plotlineRefs().slice());

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

  protected onPlotlineRefs(refs: EntityRef[]): void {
    this.plotlineRefs.set(refs.filter((r) => r.kind === 'plotline') as EntityRef<'plotline'>[]);
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
