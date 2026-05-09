import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoverSlotComponent } from '@features/media';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import { GhostButtonComponent, PrimaryButtonComponent } from '@shared/ui';
import { PlotlineDraft, PlotlineStatus } from '../data-access/plotline.types';

const STATUS_OPTIONS: { value: '' | PlotlineStatus; label: string }[] = [
  { value: '', label: '— Unset —' },
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
];

@Component({
  selector: 'app-plotline-form',
  imports: [ReactiveFormsModule, CoverSlotComponent, PrimaryButtonComponent, GhostButtonComponent],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
        {{ initial() ? 'Edit plotline' : 'Add plotline' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">Title</span>
          <input
            type="text"
            formControlName="title"
            class="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm"
            placeholder="e.g. Shadowbringers main scenario"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm"
            placeholder="e.g. shadowbringers-msq"
          />
          <span class="text-xs text-slate-500 dark:text-slate-400">Lowercase letters, digits, and hyphens. Unique within this universe.</span>
        </label>
      </div>

      <app-cover-slot
        label="Cover image"
        [assetId]="cover()"
        (picked)="cover.set($event)"
      />

      <div class="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">Description</span>
          <textarea
            formControlName="description"
            rows="3"
            class="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 py-2 text-sm"
            placeholder="High-level arc of this plotline."
          ></textarea>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">Status</span>
          <select
            formControlName="status"
            class="h-10 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 px-3 text-sm"
          >
            @for (o of statusOptions; track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-300">Color</span>
          <input
            type="color"
            formControlName="color"
            class="h-10 w-16 cursor-pointer rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1"
            aria-label="Color"
          />
        </label>
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
export class PlotlineFormComponent {
  readonly initial = input<PlotlineDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<PlotlineDraft>();
  readonly cancelled = output<void>();

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly cover = signal<string | undefined>(undefined);

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN), Validators.maxLength(SLUG_MAX_LENGTH)]],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    color: ['#6366f1'],
    status: ['' as '' | PlotlineStatus],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset({
        slug: init?.slug ?? '',
        title: init?.title ?? '',
        description: init?.description ?? '',
        color: init?.color ?? '#6366f1',
        status: init?.status ?? '',
      });
      this.cover.set(init?.coverAssetId);
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const description = v.description.trim();
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
