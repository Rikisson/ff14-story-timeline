import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CoverSlotComponent } from '@features/media';
import { SlugTakenError } from '@shared/models';
import { GhostButtonComponent, PrimaryButtonComponent } from '@shared/ui';
import { UniverseStore } from '../data-access/universe.store';
import { UniverseUpdate } from '../data-access/universe.types';
import { UniversesService } from '../data-access/universes.service';

@Component({
  selector: 'app-universe-general-settings',
  imports: [
    ReactiveFormsModule,
    CoverSlotComponent,
    PrimaryButtonComponent,
    GhostButtonComponent,
  ],
  template: `
    <section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 class="m-0 text-lg font-semibold text-foreground">General</h2>
        <p class="m-0 mt-0.5 text-sm text-foreground-subtle">
          Edit the universe's name, slug, description, and cover image.
        </p>
      </div>

      @if (universe(); as u) {
        <form [formGroup]="form" class="flex flex-col gap-3" (ngSubmit)="onSubmit()">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">Name</span>
              <input
                type="text"
                formControlName="name"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground dark:placeholder:text-slate-500 px-3 text-sm"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">Slug</span>
              <input
                type="text"
                formControlName="slug"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground dark:placeholder:text-slate-500 px-3 text-sm"
              />
              <span class="text-xs text-foreground-faint">Lowercase, hyphens. Globally unique.</span>
            </label>
          </div>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-foreground-muted">Description (optional)</span>
            <textarea
              formControlName="description"
              rows="3"
              class="rounded-md border border-border-strong bg-surface text-foreground dark:placeholder:text-slate-500 px-3 py-2 text-sm"
            ></textarea>
          </label>

          <app-cover-slot
            label="Cover image"
            [assetId]="cover()"
            (picked)="onCoverPicked($event)"
          />

          @if (errorMessage(); as e) {
            <p class="m-0 text-sm text-red-700 dark:text-red-400">{{ e }}</p>
          }

          <div class="flex gap-2">
            <button
              uiPrimary
              type="submit"
              [loading]="saving()"
              [disabled]="form.invalid || !dirty() || saving()"
            >Save</button>
            <button
              uiGhost
              type="button"
              [disabled]="!dirty() || saving()"
              (click)="reset(u)"
            >Reset</button>
          </div>
        </form>
      } @else {
        <p class="m-0 text-sm italic text-foreground-faint">No active universe.</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseGeneralSettingsComponent {
  private readonly store = inject(UniverseStore);
  private readonly service = inject(UniversesService);

  protected readonly universe = this.store.activeUniverse;
  protected readonly cover = signal<string | undefined>(undefined);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormBuilder().nonNullable.group({
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]*$/), Validators.maxLength(60)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(280)]],
  });

  private readonly formValue = signal(this.form.getRawValue());

  protected readonly dirty = computed(() => {
    const u = this.universe();
    if (!u) return false;
    const v = this.formValue();
    return (
      v.slug !== u.slug ||
      v.name !== u.name ||
      (v.description || '') !== (u.description || '') ||
      this.cover() !== u.coverAssetId
    );
  });

  constructor() {
    effect(() => {
      const u = this.universe();
      if (u) this.reset(u);
    });

    this.form.valueChanges.subscribe(() => {
      this.formValue.set(this.form.getRawValue());
    });
  }

  protected reset(u: { slug: string; name: string; description?: string; coverAssetId?: string }): void {
    this.form.reset({
      slug: u.slug,
      name: u.name,
      description: u.description ?? '',
    });
    this.formValue.set(this.form.getRawValue());
    this.cover.set(u.coverAssetId);
    this.errorMessage.set(null);
  }

  protected onCoverPicked(id: string | undefined): void {
    this.cover.set(id);
  }

  protected async onSubmit(): Promise<void> {
    const u = this.universe();
    if (!u || this.form.invalid || !this.dirty()) return;
    const v = this.form.getRawValue();
    const patch: UniverseUpdate = {
      slug: v.slug.trim().toLowerCase(),
      name: v.name.trim(),
      description: v.description.trim() || undefined,
      coverAssetId: this.cover(),
    };
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.update(u.id, patch);
      await this.store.refresh();
    } catch (err) {
      if (err instanceof SlugTakenError) {
        this.errorMessage.set(err.message);
      } else {
        this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
