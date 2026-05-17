import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { CoverSlotComponent } from '@features/media';
import { EntityRef, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import {
  EntityPickerComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { CodexEntryDraft } from '../data-access/codex-entry.types';
import { CodexCategoryTypeaheadComponent } from './codex-category-typeahead.component';
import codexEn from '../i18n/en.json';
import codexUk from '../i18n/uk.json';

/** Per `docs/backend-rules.md` *Cardinality limits*. */
const RELATED_REFS_MAX = 50;

@Component({
  selector: 'app-codex-entry-form',
  imports: [
    ReactiveFormsModule,
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    EntityPickerComponent,
    CodexCategoryTypeaheadComponent,
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
            <div class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ t('field.category') }}</span>
              <app-codex-category-typeahead
                [value]="categoryKey()"
                [placeholder]="t('empty.categoryPlaceholder')"
                (valueChange)="categoryKey.set($event)"
              />
            </div>
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
            <app-entity-picker
              [value]="related()"
              [kinds]="relatedKinds"
              [maxSelections]="relatedMax"
              [placeholder]="g('empty.searchRelated')"
              (valueChange)="related.set($event)"
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

  protected readonly relatedKinds = ['character', 'place', 'codexEntry'] as const;
  protected readonly relatedMax = RELATED_REFS_MAX;

  protected readonly related = signal<EntityRef[]>([]);
  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly categoryKey = signal<string | null>(null);

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        title: init?.title ?? '',
        description: init?.description ?? '',
      });
      this.related.set(init?.relatedRefs ?? []);
      this.cover.set(init?.coverAssetId);
      this.categoryKey.set(init?.categoryKey ?? null);
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const refs = this.related();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      title: v.title.trim(),
      categoryKey: this.categoryKey() ?? undefined,
      description: v.description.trim(),
      coverAssetId: this.cover(),
      relatedRefs: refs.length > 0 ? refs : undefined,
    });
  }
}
