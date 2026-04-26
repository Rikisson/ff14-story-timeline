import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CharacterDraft } from '../data-access/character.types';
import { GhostButtonComponent, PrimaryButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-character-form',
  imports: [ReactiveFormsModule, PrimaryButtonComponent, GhostButtonComponent],
  template: `
    <form
      [formGroup]="form"
      class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      (ngSubmit)="onSubmit()"
    >
      <h3 class="m-0 text-base font-semibold text-slate-900">
        {{ initial() ? 'Edit character' : 'Add character' }}
      </h3>

      <div class="grid gap-3 sm:grid-cols-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Name</span>
          <input
            type="text"
            formControlName="name"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Y'shtola"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Race</span>
          <input
            type="text"
            formControlName="race"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Miqo'te"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Job</span>
          <input
            type="text"
            formControlName="job"
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            placeholder="e.g. Sage"
          />
        </label>
      </div>

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
          {{ initial() ? 'Save' : 'Add' }}
        </button>
        <button uiGhost type="button" (click)="cancelled.emit()">Cancel</button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterFormComponent {
  readonly initial = input<CharacterDraft | null>(null);
  readonly busy = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<CharacterDraft>();
  readonly cancelled = output<void>();

  protected readonly form = new FormBuilder().nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    race: ['', [Validators.required, Validators.maxLength(40)]],
    job: ['', [Validators.required, Validators.maxLength(40)]],
  });

  constructor() {
    effect(() => {
      const init = this.initial();
      this.form.reset(init ?? { name: '', race: '', job: '' });
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({ name: v.name.trim(), race: v.race.trim(), job: v.job.trim() });
  }
}
