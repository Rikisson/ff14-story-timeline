import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { foldLabel } from '@shared/utils';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import { CodexCategory } from '../data-access/codex-category.types';
import codexEn from '../i18n/en.json';
import codexUk from '../i18n/uk.json';

/**
 * Single-select category typeahead for the codex-entry form. Mirrors the
 * picker UX contract (`docs/narrative-engine-impl.md` *Picker UX*) but
 * targets the codex categories config rather than the directory: results
 * come from `CodexCategoriesService.categories()` (already hydrated on
 * codex surfaces), filtering happens client-side, and the *Create
 * category "X"* affirmative row calls `createCategory` per
 * *Every saved entry's `categoryKey` exists in config*.
 *
 * The component holds two notions of state:
 *
 * - `value` — the selected category's stable `key`. Emitted via
 *   `valueChange` so the parent form can store it as `categoryKey`.
 * - `query` — the user's current text input. Hidden once a value is
 *   selected (replaced by a chip).
 */
@Component({
  selector: 'app-codex-category-typeahead',
  imports: [TranslocoDirective],
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
        <div class="flex flex-col gap-1">
          @if (selectedCategory(); as cat) {
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-medium text-foreground"
                [style.background]="cat.color || null"
              >
                <span class="truncate max-w-[14rem]">{{ cat.label }}</span>
                <button
                  type="button"
                  class="text-base leading-none"
                  [attr.aria-label]="g('action.remove') + ' ' + cat.label"
                  (click)="clearSelection()"
                >×</button>
              </span>
            </div>
          } @else {
            <div class="relative">
              <input
                type="text"
                role="combobox"
                autocomplete="off"
                spellcheck="false"
                [attr.aria-expanded]="open()"
                [attr.aria-controls]="listId"
                [attr.aria-activedescendant]="activeOptionId()"
                [placeholder]="placeholder() || t('empty.categoryPlaceholder')"
                class="h-10 w-full rounded-md border border-border-strong bg-surface text-foreground px-3 text-sm placeholder:text-foreground-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-ring"
                [disabled]="disabled() || creating()"
                [value]="query()"
                (input)="onQueryInput($event)"
                (focus)="open.set(true)"
                (blur)="onBlur($event)"
                (keydown)="onKey($event)"
              />

              @if (open()) {
                <div
                  class="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-surface shadow-md"
                >
                  @if (creating()) {
                    <p class="m-0 px-3 py-2 text-sm italic text-foreground-faint" aria-live="polite">
                      {{ g('message.loading') }}
                    </p>
                  } @else if (error(); as err) {
                    <p class="m-0 px-3 py-2 text-sm text-danger-foreground" role="alert">{{ err }}</p>
                  } @else if (filtered().length === 0 && !showCreateRow()) {
                    <p class="m-0 px-3 py-2 text-sm italic text-foreground-faint" aria-live="polite">
                      @if (query()) {
                        {{ g('empty.pickerNoMatches', { query: query() }) }}
                      } @else {
                        {{ g('empty.pickerStart') }}
                      }
                    </p>
                  } @else {
                    <ul
                      role="listbox"
                      [id]="listId"
                      class="m-0 max-h-56 list-none overflow-y-auto p-1"
                      aria-live="polite"
                    >
                      @for (cat of filtered(); track cat.id; let i = $index) {
                        <li
                          role="option"
                          [id]="optionId(i)"
                          [class]="optionClass(i === activeIndex())"
                          [attr.aria-selected]="i === activeIndex()"
                          (mousedown)="onItemMouseDown($event, cat)"
                          (mouseenter)="activeIndex.set(i)"
                        >
                          <span class="flex items-center gap-2 truncate">
                            <span
                              class="inline-block size-3 shrink-0 rounded-sm"
                              [style.background]="cat.color || 'var(--color-surface-muted)'"
                            ></span>
                            <span class="truncate">{{ cat.label }}</span>
                          </span>
                        </li>
                      }
                      @if (showCreateRow()) {
                        @let createIdx = filtered().length;
                        <li
                          role="option"
                          [id]="optionId(createIdx)"
                          [class]="optionClass(createIdx === activeIndex())"
                          [attr.aria-selected]="createIdx === activeIndex()"
                          (mousedown)="onCreateMouseDown($event)"
                          (mouseenter)="activeIndex.set(createIdx)"
                        >
                          <span class="flex items-center gap-2 truncate font-medium text-accent-foreground">
                            + {{ t('action.createCategoryAffirm', { label: query() }) }}
                          </span>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>
          }
        </div>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexCategoryTypeaheadComponent {
  /** Stable `key` of the selected category, or null. */
  readonly value = input<string | null>(null);
  readonly placeholder = input<string>('');
  readonly disabled = input<boolean>(false);
  /**
   * When `true` (the default — the codex entry form's case), an
   * affirmative *Create category "X"* row appears for novel labels. When
   * `false` (filter contexts), the create row is suppressed and unknown
   * queries just show *no matches*. The filter never wants to create
   * categories, only pick from existing ones.
   */
  readonly allowCreate = input<boolean>(true);
  readonly valueChange = output<string | null>();

  private readonly service = inject(CodexCategoriesService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly listId = `codex-cat-list-${nextId()}`;

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly categories = this.service.categories;
  protected readonly categoryByKey = this.service.categoryByKey;

  protected readonly selectedCategory = computed<CodexCategory | null>(() => {
    const key = this.value();
    if (!key) return null;
    return this.categoryByKey().get(key) ?? null;
  });

  protected readonly filtered = computed<CodexCategory[]>(() => {
    const q = foldLabel(this.query());
    const list = this.categories();
    if (!q) return list.slice(0, 20);
    return list
      .filter((c) => foldLabel(c.label).includes(q) || (c.key ?? '').includes(q))
      .slice(0, 20);
  });

  protected readonly showCreateRow = computed(() => {
    if (!this.allowCreate()) return false;
    const q = this.query().trim();
    if (!q) return false;
    const folded = foldLabel(q);
    return !this.filtered().some((c) => foldLabel(c.label) === folded || c.key === folded);
  });

  protected readonly activeOptionId = computed<string | null>(() => {
    if (!this.open()) return null;
    const i = this.activeIndex();
    const total = this.filtered().length + (this.showCreateRow() ? 1 : 0);
    if (i < 0 || i >= total) return null;
    return this.optionId(i);
  });

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.open.set(true);
  }

  protected onBlur(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this.open.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    const total = this.filtered().length + (this.showCreateRow() ? 1 : 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      if (total === 0) return;
      this.activeIndex.update((i) => (i + 1) % total);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (total === 0) return;
      this.activeIndex.update((i) => (i - 1 + total) % total);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.commitActive();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (this.query()) {
        this.query.set('');
      } else {
        this.open.set(false);
      }
    }
  }

  protected onItemMouseDown(event: MouseEvent, cat: CodexCategory): void {
    event.preventDefault();
    this.select(cat);
  }

  protected onCreateMouseDown(event: MouseEvent): void {
    event.preventDefault();
    void this.triggerCreate();
  }

  protected clearSelection(): void {
    this.valueChange.emit(null);
    this.query.set('');
    this.open.set(true);
  }

  private commitActive(): void {
    const i = this.activeIndex();
    const filtered = this.filtered();
    if (this.showCreateRow() && i === filtered.length) {
      void this.triggerCreate();
      return;
    }
    const cat = filtered[i];
    if (cat) this.select(cat);
  }

  private select(cat: CodexCategory): void {
    if (!cat.key) return;
    this.valueChange.emit(cat.key);
    this.query.set('');
    this.open.set(false);
  }

  private async triggerCreate(): Promise<void> {
    const label = this.query().trim();
    if (!label) return;
    this.creating.set(true);
    this.error.set(null);
    try {
      const created = await this.service.createCategory({ label });
      this.select(created);
    } catch (err) {
      this.error.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.creating.set(false);
    }
  }

  protected optionId(index: number): string {
    return `${this.listId}-opt-${index}`;
  }

  protected optionClass(active: boolean): string {
    const base =
      'flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm';
    return active
      ? `${base} bg-accent-soft text-accent-soft-foreground`
      : `${base} text-foreground-muted`;
  }
}

let _nextId = 0;
function nextId(): number {
  return ++_nextId;
}
