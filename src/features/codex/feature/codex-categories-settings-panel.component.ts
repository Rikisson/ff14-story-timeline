import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { foldLabel } from '@shared/utils';
import { ProjectionRebuildService } from '../../../app/data-access/projection-rebuild.service';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import {
  CategoryInUseError,
  CodexCategoriesConfig,
  CodexCategory,
  StaleCategoriesError,
} from '../data-access/codex-category.types';
import codexEn from '../i18n/en.json';
import codexUk from '../i18n/uk.json';

interface InlineConflict {
  /** Index in the draft list of the OTHER category that conflicts. */
  withIndex: number;
  /** That other category's label, for the error copy. */
  withLabel: string;
}

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
        <section class="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="m-0 text-base font-semibold text-foreground">{{ t('field.categoriesHeader') }}</h2>
              <p class="m-0 mt-0.5 text-sm text-foreground-subtle">
                {{ t('message.categoriesSubtitle') }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              @if (canEdit()) {
                <button uiSecondary type="button" (click)="addCategory()">{{ t('action.addCategory') }}</button>
              }
              @if (dirty()) {
                <span class="text-sm text-warning-foreground">{{ t('message.unsavedChanges') }}</span>
              }
              <button uiGhost type="button" [disabled]="!dirty()" (click)="reset()">{{ t('action.reset') }}</button>
              <button
                uiPrimary
                type="button"
                [loading]="saving()"
                [disabled]="!dirty() || saving() || !canEdit() || hasConflicts()"
                (click)="save()"
              >
                {{ g('action.save') }}
              </button>
            </div>
          </header>

          @if (errorMessage(); as e) {
            <p class="m-0 text-sm text-danger-foreground">
              {{ e }}
              @if (inUseError(); as ue) {
                <span class="block mt-1">
                  {{ t('message.inUseHint', { count: ue.usageCount }) }}
                </span>
              }
            </p>
          }

          @if (rebuildProgress(); as p) {
            <p class="m-0 text-sm text-warning-foreground" role="status">
              {{ t('message.rebuildingCategory', { processed: p.processed, total: p.total }) }}
            </p>
          }

          @if (categories().length === 0) {
            <p class="text-sm text-foreground-subtle">{{ t('empty.categoriesList') }}</p>
          } @else {
            <ul
              class="grid min-h-0 list-none gap-3 overflow-y-auto p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              @for (cat of categories(); track cat.id; let i = $index) {
                <li
                  class="flex flex-col gap-2 rounded-lg border bg-surface p-3 shadow-sm"
                  [class.border-danger-border]="conflictByIndex().has(i)"
                  [class.border-border]="!conflictByIndex().has(i)"
                >
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      class="h-10 flex-1 rounded-md border bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                      [class.border-danger-border]="conflictByIndex().has(i)"
                      [class.border-border-strong]="!conflictByIndex().has(i)"
                      [value]="cat.label"
                      [disabled]="!canEdit()"
                      [placeholder]="t('empty.categoryLabelPlaceholder')"
                      [attr.aria-label]="t('tooltip.labelAria')"
                      [attr.aria-invalid]="conflictByIndex().has(i) ? 'true' : null"
                      (input)="updateCategory(i, { label: text($event) })"
                    />
                    @if (conflictByIndex().get(i); as conflict) {
                      <span class="sr-only" role="alert">
                        {{ t('message.categoryConflict', { other: conflict.withLabel }) }}
                      </span>
                    }
                    <input
                      type="color"
                      class="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
                      [value]="cat.color ?? '#64748b'"
                      [disabled]="!canEdit()"
                      [attr.aria-label]="t('tooltip.colorAria')"
                      (input)="updateCategory(i, { color: text($event) })"
                    />
                  </div>
                  <input
                    type="text"
                    class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 text-sm"
                    [value]="cat.description ?? ''"
                    [disabled]="!canEdit()"
                    [placeholder]="t('empty.categoryDescriptionPlaceholder')"
                    [attr.aria-label]="t('tooltip.descriptionAria')"
                    (input)="updateCategory(i, { description: text($event) || undefined })"
                  />
                  @if (conflictByIndex().get(i); as conflict) {
                    <p class="m-0 text-xs text-danger-foreground">
                      {{ t('message.categoryConflict', { other: conflict.withLabel }) }}
                    </p>
                  }
                  @if (canEdit()) {
                    <div class="mt-auto flex justify-end">
                      <button uiDanger type="button" (click)="removeCategory(i)">{{ g('action.remove') }}</button>
                    </div>
                  }
                </li>
              }
            </ul>
          }
        </section>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexCategoriesSettingsPanelComponent {
  protected readonly service = inject(CodexCategoriesService);
  protected readonly rebuild = inject(ProjectionRebuildService);
  private readonly user = inject(AuthStore).user;
  private readonly universes = inject(UniverseStore);

  protected readonly canEdit = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly draft = signal<CodexCategoriesConfig>(this.service.config());
  protected readonly categories = computed<CodexCategory[]>(() => this.draft().categories);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly inUseError = signal<CategoryInUseError | null>(null);

  protected readonly dirty = computed(
    () => !sameConfig(this.draft(), this.service.config()),
  );

  /**
   * Inline collision check per `docs/narrative-engine-impl.md` *Codex
   * categories — Folded labels and keys are unique within the universe*.
   * Returns the conflicting category's metadata so the panel can name
   * it ("Conflicts with 'Items — Equipment'") rather than just rejecting
   * with a generic error.
   *
   * Mirrors the transactional check in
   * `CodexCategoriesService.finaliseSave`, so an inline-clean draft is
   * also valid against the saved config (modulo the OCC race window).
   */
  protected readonly conflictByIndex = computed<Map<number, InlineConflict>>(() => {
    const cats = this.categories();
    const out = new Map<number, InlineConflict>();
    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i];
      const folded = foldLabel(cat.label);
      if (!folded) continue;
      for (let j = 0; j < cats.length; j++) {
        if (i === j) continue;
        const other = cats[j];
        const otherFolded = foldLabel(other.label);
        if (otherFolded && otherFolded === folded) {
          out.set(i, { withIndex: j, withLabel: other.label || '(unnamed)' });
          break;
        }
        if (other.key && other.key === folded) {
          out.set(i, { withIndex: j, withLabel: other.label || '(unnamed)' });
          break;
        }
      }
    }
    return out;
  });

  protected readonly hasConflicts = computed(() => this.conflictByIndex().size > 0);

  /** Bound by the template to render the in-flight rebuild toast. */
  protected readonly rebuildProgress = computed(() => {
    const p = this.rebuild.progress();
    return p.phase === 'processing' || p.phase === 'starting' ? p : null;
  });

  /**
   * Renames detected at save time: an existing category whose label
   * folded to a new value while its `key` stayed the same. Each rename
   * dirties every codex directory row with that `categoryKey` (the
   * denormalized `secondary` label), so a `rebuildForCategoryRename`
   * pass runs after the config write per `docs/backend-rules.md`
   * *Write discipline*.
   */
  private detectRenamedKeys(prev: CodexCategory[], next: CodexCategory[]): string[] {
    const prevById = new Map(prev.map((c) => [c.id, c]));
    const out: string[] = [];
    for (const n of next) {
      const p = prevById.get(n.id);
      if (!p || !n.key) continue;
      if (foldLabel(p.label) !== foldLabel(n.label)) out.push(n.key);
    }
    return out;
  }

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
    if (this.hasConflicts()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.inUseError.set(null);
    const prevCategories = this.service.config().categories;
    const nextCategories = this.draft().categories;
    try {
      const expectedVersion = this.service.config().version ?? 0;
      await this.service.save(this.draft(), expectedVersion);
    } catch (err) {
      if (err instanceof StaleCategoriesError) {
        // Force re-pull so the user sees what they're about to overwrite
        // before retrying their edit. Without the refresh the panel would
        // still show their stale draft.
        await this.service.refresh();
      } else if (err instanceof CategoryInUseError) {
        this.inUseError.set(err);
      }
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      this.saving.set(false);
      return;
    }
    this.saving.set(false);

    // Fire a chunked projection rebuild for each renamed category — the
    // categories config write only flips `_meta`, so directory rows
    // carrying the denormalized `secondary` label need a sweep.
    const renamedKeys = this.detectRenamedKeys(prevCategories, nextCategories);
    if (renamedKeys.length === 0) return;
    const universeId = this.universes.activeUniverseId();
    if (!universeId) return;
    for (const key of renamedKeys) {
      try {
        await this.rebuild.rebuildForCategoryRename(universeId, key);
      } catch (err) {
        this.errorMessage.set(
          err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        );
        return;
      }
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
