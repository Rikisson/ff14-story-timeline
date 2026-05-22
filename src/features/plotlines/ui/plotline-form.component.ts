import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CoverSlotComponent } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import { GhostButtonComponent, PrimaryButtonComponent, RichTextInputComponent } from '@shared/ui';
import { PlotlineDraft, PlotlineStatus } from '../data-access/plotline.types';
import plotlineEn from '../i18n/en.json';
import plotlineUk from '../i18n/uk.json';

const STATUS_OPTIONS: { value: '' | PlotlineStatus; labelKey: string }[] = [
  { value: '', labelKey: 'field.statusUnset' },
  { value: 'planned', labelKey: 'field.statusPlanned' },
  { value: 'active', labelKey: 'field.statusActive' },
  { value: 'resolved', labelKey: 'field.statusResolved' },
];

@Component({
  selector: 'app-plotline-form',
  imports: [
    ReactiveFormsModule,
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
    RichTextInputComponent,
    TranslocoDirective,
    ContentLangDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'plotline',
      loader: {
        en: () => Promise.resolve(plotlineEn),
        uk: () => Promise.resolve(plotlineUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'plotline'">
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
              [ariaLabel]="g('tooltip.descriptionAria')"
              [placeholder]="t('empty.descriptionPlaceholder')"
              (valueChange)="description.set($event)"
            />
          </div>

          <div class="flex flex-wrap gap-3 text-sm">
            <label class="flex flex-col gap-1">
              <span class="font-medium text-foreground-muted">{{ g('field.status') }}</span>
              <select
                formControlName="status"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground px-3 text-sm"
              >
                @for (o of statusOptionLabels(); track o.value) {
                  <option [value]="o.value">{{ o.label }}</option>
                }
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="font-medium text-foreground-muted">{{ g('field.color') }}</span>
              <input
                type="color"
                formControlName="color"
                class="h-10 w-16 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
                [attr.aria-label]="t('tooltip.colorAria')"
              />
            </label>
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
export class PlotlineFormComponent {
  readonly initial = input<PlotlineDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<PlotlineDraft>();
  readonly cancelled = output<void>();

  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly description = signal<string>('');

  protected readonly statusOptionLabels = computed(() => {
    this.activeLang();
    return STATUS_OPTIONS.map((o) => ({
      value: o.value,
      label: this.transloco.translate(`plotline.${o.labelKey}`),
    }));
  });

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    color: ['#6366f1'],
    status: ['' as '' | PlotlineStatus],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        title: init?.title ?? '',
        color: init?.color ?? '#6366f1',
        status: init?.status ?? '',
      });
      this.description.set(init?.description ?? '');
      this.cover.set(init?.coverAssetId);
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const description = this.description().trim();
    const color = v.color.trim();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      title: v.title.trim(),
      description: description || undefined,
      coverAssetId: this.cover(),
      color: color || undefined,
      status: v.status === '' ? undefined : v.status,
    });
  }
}
