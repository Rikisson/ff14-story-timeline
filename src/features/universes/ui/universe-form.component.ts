import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { GhostButtonComponent, PrimaryButtonComponent } from '@shared/ui';
import { UniverseDraft } from '../data-access/universe.types';
import universeEn from '../i18n/en.json';
import universeUk from '../i18n/uk.json';

@Component({
  selector: 'app-universe-form',
  imports: [ReactiveFormsModule, PrimaryButtonComponent, GhostButtonComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'universe',
      loader: {
        en: () => Promise.resolve(universeEn),
        uk: () => Promise.resolve(universeUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'universe'">
      <ng-container *transloco="let g; prefix: 'general'">
        <form
          [formGroup]="form"
          class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
          (ngSubmit)="onSubmit()"
        >
          <h3 class="m-0 text-base font-semibold text-foreground">{{ t('field.createDialogTitle') }}</h3>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.slug') }}</span>
              <input
                type="text"
                formControlName="slug"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                [placeholder]="t('empty.slugPlaceholder')"
              />
              <span class="text-xs text-foreground-faint">{{ t('message.globalSlugHint') }}</span>
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.name') }}</span>
              <input
                type="text"
                formControlName="name"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                [placeholder]="t('empty.namePlaceholder')"
              />
            </label>
          </div>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">{{ g('field.descriptionOptional') }}</span>
            <textarea
              formControlName="description"
              rows="3"
              class="rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 py-2 text-sm"
            ></textarea>
          </label>

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
              {{ t('action.create') }}
            </button>
            <button uiGhost type="button" (click)="cancelled.emit()">{{ g('action.cancel') }}</button>
          </div>
        </form>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseFormComponent {
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<UniverseDraft>();
  readonly cancelled = output<void>();

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]*$/), Validators.maxLength(60)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(280)]],
  });

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      description: v.description.trim() || undefined,
    });
  }
}
