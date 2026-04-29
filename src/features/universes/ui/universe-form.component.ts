import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GhostButtonComponent, PrimaryButtonComponent } from '@shared/ui';
import { UniverseDraft } from '../data-access/universe.types';

@Component({
  selector: 'app-universe-form',
  imports: [ReactiveFormsModule, PrimaryButtonComponent, GhostButtonComponent],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-slate-900">Create universe</h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. ff14-canon"
          />
          <span class="text-xs text-slate-500">Lowercase, hyphens. Globally unique.</span>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. FF14 Canon"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Description (optional)</span>
        <textarea
          formControlName="description"
          rows="3"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        ></textarea>
      </label>

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
          Create
        </button>
        <button uiGhost type="button" (click)="cancelled.emit()">Cancel</button>
      </div>
    </form>
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
