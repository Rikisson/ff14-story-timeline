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
      class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-foreground">
        {{ initial() ? 'Edit plotline' : 'Add plotline' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-foreground-muted">Title</span>
          <input
            type="text"
            formControlName="title"
            class="h-10 rounded-md border border-border-strong bg-surface text-foreground dark:placeholder:text-slate-500 px-3 text-sm"
            placeholder="e.g. Shadowbringers main scenario"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-foreground-muted">Slug</span>
          <input
            type="text"
            formControlName="slug"
            class="h-10 rounded-md border border-border-strong bg-surface text-foreground dark:placeholder:text-slate-500 px-3 text-sm"
            placeholder="e.g. shadowbringers-msq"
          />
          <span class="text-xs text-foreground-faint">Lowercase letters, digits, and hyphens. Unique within this universe.</span>
        </label>
      </div>

      <app-cover-slot
        label="Cover image"
        [assetId]="cover()"
        (picked)="cover.set($event)"
      />

      <div class="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-foreground-muted">Description</span>
          <textarea
            formControlName="description"
            rows="3"
            class="rounded-md border border-border-strong bg-surface text-foreground dark:placeholder:text-slate-500 px-3 py-2 text-sm"
            placeholder="High-level arc of this plotline."
          ></textarea>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-foreground-muted">Status</span>
          <select
            formControlName="status"
            class="h-10 rounded-md border border-border-strong bg-surface text-foreground px-3 text-sm"
          >
            @for (o of statusOptions; track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-foreground-muted">Color</span>
          <input
            type="color"
            formControlName="color"
            class="h-10 w-16 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
            aria-label="Color"
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
