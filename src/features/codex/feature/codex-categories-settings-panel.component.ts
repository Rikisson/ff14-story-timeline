import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import {
  CodexCategoriesConfig,
  CodexCategory,
} from '../data-access/codex-category.types';

function sameConfig(a: CodexCategoriesConfig, b: CodexCategoriesConfig): boolean {
  if (a.categories.length !== b.categories.length) return false;
  for (let i = 0; i < a.categories.length; i++) {
    const x = a.categories[i];
    const y = b.categories[i];
    if (
      x.id !== y.id ||
      x.label !== y.label ||
      (x.color ?? '') !== (y.color ?? '') ||
      (x.description ?? '') !== (y.description ?? '')
    ) {
      return false;
    }
  }
  return true;
}

@Component({
  selector: 'app-codex-categories-settings-panel',
  imports: [
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
    DangerButtonComponent,
  ],
  template: `
    <section class="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-lg font-semibold text-slate-900">Categories</h2>
          <p class="m-0 mt-0.5 text-sm text-slate-600">
            Color-coded buckets for codex entries. Authors can still type free-form categories on entries; pickers surface this canonical set.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          @if (canEdit()) {
            <button uiSecondary type="button" (click)="addCategory()">+ Add category</button>
          }
          @if (dirty()) {
            <span class="text-sm text-amber-700">Unsaved changes</span>
          }
          <button uiGhost type="button" [disabled]="!dirty()" (click)="reset()">Reset</button>
          <button
            uiPrimary
            type="button"
            [loading]="saving()"
            [disabled]="!dirty() || saving() || !canEdit()"
            (click)="save()"
          >
            Save
          </button>
        </div>
      </header>

      @if (errorMessage(); as e) {
        <p class="m-0 text-sm text-red-700">{{ e }}</p>
      }

      @if (categories().length === 0) {
        <p class="text-sm text-slate-600">No categories yet.</p>
      } @else {
        <ul
          class="grid min-h-0 list-none gap-3 overflow-y-auto p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          @for (cat of categories(); track cat.id; let i = $index) {
            <li
              class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  class="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  [value]="cat.label"
                  [disabled]="!canEdit()"
                  placeholder="Label"
                  aria-label="Label"
                  (input)="updateCategory(i, { label: text($event) })"
                />
                <input
                  type="color"
                  class="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                  [value]="cat.color ?? '#64748b'"
                  [disabled]="!canEdit()"
                  aria-label="Color"
                  (input)="updateCategory(i, { color: text($event) })"
                />
              </div>
              <input
                type="text"
                class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                [value]="cat.description ?? ''"
                [disabled]="!canEdit()"
                placeholder="Description (optional)"
                aria-label="Description"
                (input)="updateCategory(i, { description: text($event) || undefined })"
              />
              @if (canEdit()) {
                <div class="mt-auto flex justify-end">
                  <button uiDanger type="button" (click)="removeCategory(i)">Remove</button>
                </div>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexCategoriesSettingsPanelComponent {
  protected readonly service = inject(CodexCategoriesService);
  private readonly user = inject(AuthStore).user;
  private readonly universes = inject(UniverseStore);

  protected readonly canEdit = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly draft = signal<CodexCategoriesConfig>(this.service.config());
  protected readonly categories = computed<CodexCategory[]>(() => this.draft().categories);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly dirty = computed(
    () => !sameConfig(this.draft(), this.service.config()),
  );

  constructor() {
    let lastServerSnapshot = this.service.config();
    effect(() => {
      const current = this.service.config();
      if (current !== lastServerSnapshot) {
        if (sameConfig(this.draft(), lastServerSnapshot)) {
          this.draft.set(current);
        }
        lastServerSnapshot = current;
      }
    });
  }

  protected reset(): void {
    this.draft.set(this.service.config());
    this.errorMessage.set(null);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.save(this.draft());
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected addCategory(): void {
    this.draft.update((c) => ({
      ...c,
      categories: [
        ...c.categories,
        { id: crypto.randomUUID(), label: '', color: '#64748b' },
      ],
    }));
  }

  protected updateCategory(index: number, patch: Partial<CodexCategory>): void {
    this.draft.update((c) => {
      const next = [...c.categories];
      next[index] = { ...next[index], ...patch };
      return { ...c, categories: next };
    });
  }

  protected removeCategory(index: number): void {
    this.draft.update((c) => ({
      ...c,
      categories: c.categories.filter((_, i) => i !== index),
    }));
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
