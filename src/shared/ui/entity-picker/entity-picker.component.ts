import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  EntityDirectoryService,
  EntityResolverCache,
  ResolvedDirectoryRow,
} from '@shared/data-access';
import { EntityKind, EntityRef } from '@shared/models';
import { foldLabel, KIND_PICKER_CLASS } from '@shared/utils';
import { UniverseStore } from '@features/universes';

const DEBOUNCE_MS = 180;
const DEFAULT_RESULT_LIMIT = 20;

export interface EntityPickerCreateOption<R extends { kind: EntityKind; id: string } = EntityRef> {
  /** Translation key for the *Create "X"* row label. Receives `{ label }`. */
  labelKey: string;
  /** Affirmative create handler. Resolves to the created ref, which is added to selection. */
  onCreate: (label: string) => Promise<R | null>;
}

/**
 * Shared directory-backed picker per `docs/narrative-engine-impl.md`
 * *Picker UX*. Powers related-ref pickers, plotline filters, and the
 * inline-ref suggestion popup.
 *
 * - 180 ms debounced search against `EntityDirectoryService.prefixSearch`.
 * - Stale-response guard (sequence number) — only the latest query's
 *   results are rendered.
 * - Selected chips resolve independently via `EntityResolverCache`, so
 *   they stay rendered even when the current query doesn't include them.
 * - Loading / no-results / error states with retry.
 * - Keyboard navigation (Arrow/Enter/Escape/Backspace), `aria-live` for
 *   result announcements, `aria-controls` pairing the input with the
 *   listbox.
 * - Optional *Draft* pill on rows when `includeDrafts` is on.
 * - Optional *Create "X"* affirmative row via `createOption` — used by
 *   the codex category typeahead per *Codex categories — Every saved
 *   entry's `categoryKey` exists in config*.
 *
 * The picker fans out one query per requested kind so it can serve
 * mixed-kind surfaces (related-refs accept character/place/codex). Each
 * fan-out chunk is capped at `DEFAULT_RESULT_LIMIT` per kind.
 */
@Component({
  selector: 'app-entity-picker',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <div class="flex flex-col gap-1">
        @if (selectedChips().length > 0) {
          <ul class="flex flex-wrap gap-1" role="list">
            @for (chip of selectedChips(); track chip.refKey) {
              <li>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md border py-0.5 pl-3 pr-1 text-xs font-medium"
                  [class]="chipClass(chip.kind)"
                  [attr.aria-label]="t('action.remove') + ' ' + chip.label"
                  (click)="remove(chip.refKey)"
                >
                  <span class="truncate max-w-[14rem]">{{ chip.label }}</span>
                  @if (chip.draft) {
                    <span
                      class="rounded bg-warning-soft px-1 text-[10px] font-semibold uppercase text-warning-foreground"
                    >{{ t('field.draftPill') }}</span>
                  }
                  <span class="text-base leading-none" aria-hidden="true">×</span>
                </button>
              </li>
            }
          </ul>
        }

        <div class="relative">
          <input
            #queryInput
            type="text"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            [id]="inputId"
            [attr.aria-expanded]="open()"
            [attr.aria-controls]="listboxId"
            [attr.aria-busy]="loading() ? 'true' : null"
            [attr.aria-activedescendant]="activeOptionId()"
            [attr.aria-disabled]="atMax() && !query() ? 'true' : null"
            [placeholder]="placeholder()"
            class="h-10 w-full rounded-md border border-border-strong bg-surface text-foreground px-3 text-sm placeholder:text-foreground-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-ring disabled:opacity-50"
            [disabled]="disabled()"
            [value]="query()"
            (input)="onQueryInput($event)"
            (focus)="onFocus()"
            (blur)="onBlur($event)"
            (keydown)="onKey($event)"
          />

          @if (open()) {
            <div
              class="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-surface shadow-lg"
            >
              @if (error()) {
                <div class="flex items-center justify-between gap-2 px-3 py-2 text-sm text-danger-foreground">
                  <span>{{ t('message.pickerError') }}</span>
                  <button
                    type="button"
                    class="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface-subtle"
                    (mousedown)="onRetryMouseDown($event)"
                  >{{ t('action.retry') }}</button>
                </div>
              } @else if (loading()) {
                <p
                  class="m-0 px-3 py-2 text-sm italic text-foreground-faint"
                  aria-live="polite"
                >{{ t('message.loading') }}</p>
              } @else if (visibleResults().length === 0 && !showCreateRow()) {
                <p
                  class="m-0 px-3 py-2 text-sm italic text-foreground-faint"
                  aria-live="polite"
                >
                  @if (query()) {
                    {{ t('empty.pickerNoMatches', { query: query() }) }}
                  } @else {
                    {{ t('empty.pickerStart') }}
                  }
                </p>
              } @else {
                <ul
                  role="listbox"
                  [id]="listboxId"
                  class="m-0 max-h-56 list-none overflow-y-auto p-1"
                  aria-live="polite"
                >
                  @for (row of visibleResults(); track row.refKey; let i = $index) {
                    <li
                      role="option"
                      [id]="optionId(i)"
                      [class]="optionClass(i === activeIndex())"
                      [attr.aria-selected]="i === activeIndex()"
                      (mousedown)="onItemMouseDown($event, row)"
                      (mouseenter)="activeIndex.set(i)"
                    >
                      <span class="flex items-center gap-2 truncate">
                        <span class="truncate">{{ row.label }}</span>
                        @if (row.draft) {
                          <span
                            class="rounded bg-warning-soft px-1 text-[10px] font-semibold uppercase text-warning-foreground"
                          >{{ t('field.draftPill') }}</span>
                        }
                      </span>
                      @if (row.secondary; as s) {
                        <span class="text-xs text-foreground-faint truncate">{{ s }}</span>
                      }
                    </li>
                  }
                  @if (showCreateRow()) {
                    @let createIdx = visibleResults().length;
                    <li
                      role="option"
                      [id]="optionId(createIdx)"
                      [class]="optionClass(createIdx === activeIndex())"
                      [attr.aria-selected]="createIdx === activeIndex()"
                      (mousedown)="onCreateMouseDown($event)"
                      (mouseenter)="activeIndex.set(createIdx)"
                    >
                      <span class="flex items-center gap-2 truncate font-medium text-accent-foreground">
                        + {{ t(createOption()!.labelKey, { label: query() }) }}
                      </span>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </div>

        @if (atMax()) {
          <p class="m-0 text-xs text-foreground-faint">
            {{ t('message.pickerMaxReached', { max: maxSelections() }) }}
          </p>
        }
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityPickerComponent {
  /** Selected refs. Treat as immutable; mutations emit through `valueChange`. */
  readonly value = input<readonly EntityRef[]>([]);
  /** Kinds the picker queries. Empty = all kinds. */
  readonly kinds = input<readonly EntityKind[]>([]);
  /** Members-only: include draft rows in results. Surfaces a *Draft* pill. */
  readonly includeDrafts = input<boolean>(false);
  /** Single-select vs multi-select. Single-select replaces the previous value. */
  readonly multiple = input<boolean>(true);
  /** Cap selections (e.g. 10 for plotlineRefs, 50 for relatedRefs). null = no cap. */
  readonly maxSelections = input<number | null>(null);
  readonly placeholder = input<string>('');
  readonly disabled = input<boolean>(false);
  /** Opt-in *Create "X"* affirmative row. Only used by the codex variant today. */
  readonly createOption = input<EntityPickerCreateOption | null>(null);

  readonly valueChange = output<EntityRef[]>();

  private readonly directory = inject(EntityDirectoryService);
  private readonly resolver = inject(EntityResolverCache);
  private readonly universes = inject(UniverseStore);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly inputId = `entity-picker-input-${nextId()}`;
  protected readonly listboxId = `entity-picker-list-${nextId()}`;

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly results = signal<DisplayRow[]>([]);

  private readonly resolvedSelections = this.resolver.resolveMany(this.value);

  protected readonly selectedChips = computed<DisplayChip[]>(() => {
    const resolved = this.resolvedSelections();
    return this.value().map((ref) => {
      const key = `${ref.kind}:${ref.id}`;
      const row = resolved.get(key);
      return {
        refKey: key,
        kind: ref.kind,
        id: ref.id,
        // Match `<app-entity-ref>`'s fallback: unresolved chips show
        // `'?'` rather than the raw GUID. A deleted/in-flight ref is
        // identifiable by its kind colour + position; surfacing the ID
        // is worse than admitting we can't name it yet.
        label: row?.label ?? '?',
        draft: row?.draft ?? false,
      };
    });
  });

  protected readonly atMax = computed(() => {
    const max = this.maxSelections();
    return max != null && this.value().length >= max;
  });

  /** Already-selected refs are hidden from the dropdown. */
  protected readonly visibleResults = computed<DisplayRow[]>(() => {
    const selected = new Set(this.value().map((r) => `${r.kind}:${r.id}`));
    return this.results().filter((r) => !selected.has(r.refKey));
  });

  protected readonly showCreateRow = computed(() => {
    const create = this.createOption();
    if (!create) return false;
    const q = this.query().trim();
    if (!q) return false;
    if (this.atMax()) return false;
    const folded = foldLabel(q);
    return !this.visibleResults().some((r) => foldLabel(r.label) === folded);
  });

  protected readonly activeOptionId = computed<string | null>(() => {
    if (!this.open()) return null;
    const i = this.activeIndex();
    const total = this.visibleResults().length + (this.showCreateRow() ? 1 : 0);
    if (i < 0 || i >= total) return null;
    return this.optionId(i);
  });

  /** Each search increments seq; only the latest seq writes results back. */
  private seq = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    toObservable(this.query)
      .pipe(
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((q) => {
        void this.runSearch(q);
      });

    // Re-run the current query when the active universe changes — the
    // directory service binds to it through inject(UniverseStore).
    effect(() => {
      // Tracking `kinds` and `includeDrafts` so a parent toggling these
      // re-queries immediately rather than waiting for the next keystroke.
      this.kinds();
      this.includeDrafts();
      void this.runSearch(this.query());
    });
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.open.set(true);
  }

  protected onFocus(): void {
    this.open.set(true);
    if (this.visibleResults().length === 0 && !this.loading() && !this.error()) {
      void this.runSearch(this.query());
    }
  }

  protected onBlur(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this.open.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    const total = this.visibleResults().length + (this.showCreateRow() ? 1 : 0);
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
    } else if (event.key === 'Backspace' && this.query() === '') {
      const last = this.value()[this.value().length - 1];
      if (last) {
        event.preventDefault();
        this.removeRef(last);
      }
    }
  }

  protected onItemMouseDown(event: MouseEvent, row: DisplayRow): void {
    event.preventDefault();
    this.addRow(row);
  }

  protected onCreateMouseDown(event: MouseEvent): void {
    event.preventDefault();
    void this.triggerCreate();
  }

  protected onRetryMouseDown(event: MouseEvent): void {
    event.preventDefault();
    void this.runSearch(this.query());
  }

  protected remove(refKey: string): void {
    const next = this.value().filter((r) => `${r.kind}:${r.id}` !== refKey);
    this.valueChange.emit(next);
  }

  private removeRef(ref: EntityRef): void {
    this.valueChange.emit(this.value().filter((r) => !(r.kind === ref.kind && r.id === ref.id)));
  }

  private commitActive(): void {
    const i = this.activeIndex();
    const rows = this.visibleResults();
    if (this.showCreateRow() && i === rows.length) {
      void this.triggerCreate();
      return;
    }
    const row = rows[i];
    if (row) this.addRow(row);
  }

  private addRow(row: DisplayRow): void {
    const ref: EntityRef = { kind: row.kind, id: row.id };
    this.addRef(ref);
  }

  private addRef(ref: EntityRef): void {
    if (this.atMax()) return;
    const exists = this.value().some((r) => r.kind === ref.kind && r.id === ref.id);
    if (exists) {
      // Already selected — clear the query and close, no state churn.
      this.query.set('');
      return;
    }
    const next = this.multiple() ? [...this.value(), ref] : [ref];
    this.valueChange.emit(next);
    this.query.set('');
    this.activeIndex.set(0);
    if (!this.multiple()) this.open.set(false);
  }

  private async triggerCreate(): Promise<void> {
    const create = this.createOption();
    if (!create) return;
    const label = this.query().trim();
    if (!label) return;
    if (this.atMax()) return;
    try {
      const ref = await create.onCreate(label);
      if (ref) this.addRef(ref);
    } catch (err) {
      this.error.set(err);
    }
  }

  private async runSearch(rawQuery: string): Promise<void> {
    const universeId = this.universes.activeUniverseId();
    const seq = ++this.seq;
    if (!universeId) {
      this.results.set([]);
      this.loading.set(false);
      this.error.set(null);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const kinds = this.kinds();
      const includeDrafts = this.includeDrafts();
      let rows: ResolvedDirectoryRow[];
      if (kinds.length === 0) {
        rows = await this.directory.prefixSearch({
          universeId,
          query: rawQuery,
          includeDrafts,
        });
      } else {
        const perKind = await Promise.all(
          kinds.map((kind) =>
            this.directory.prefixSearch({
              universeId,
              query: rawQuery,
              kind,
              includeDrafts,
              limit: DEFAULT_RESULT_LIMIT,
            }),
          ),
        );
        rows = perKind
          .flat()
          .sort((a, b) => foldLabel(a.label).localeCompare(foldLabel(b.label)))
          .slice(0, DEFAULT_RESULT_LIMIT);
      }
      if (seq !== this.seq) return;
      this.results.set(rows.map(toDisplayRow));
      this.activeIndex.set(0);
    } catch (err) {
      if (seq !== this.seq) return;
      this.error.set(err);
      this.results.set([]);
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  protected optionId(index: number): string {
    return `${this.listboxId}-opt-${index}`;
  }

  protected optionClass(active: boolean): string {
    const base =
      'flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm';
    return active
      ? `${base} bg-accent-soft text-accent-soft-foreground`
      : `${base} text-foreground-muted`;
  }

  protected chipClass(kind: EntityKind): string {
    return KIND_PICKER_CLASS[kind];
  }
}

interface DisplayRow {
  refKey: string;
  kind: EntityKind;
  id: string;
  label: string;
  secondary?: string;
  draft: boolean;
}

interface DisplayChip {
  refKey: string;
  kind: EntityKind;
  id: string;
  label: string;
  draft: boolean;
}

function toDisplayRow(row: ResolvedDirectoryRow): DisplayRow {
  return {
    refKey: `${row.kind}:${row.id}`,
    kind: row.kind,
    id: row.id,
    label: row.label,
    secondary: row.secondary,
    draft: row.draft === true,
  };
}

let _nextId = 0;
function nextId(): number {
  return ++_nextId;
}
