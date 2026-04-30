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

export interface ComboboxOption {
  id: string;
  label: string;
  hint?: string;
}

@Component({
  selector: 'app-combobox-picker',
  template: `
    @if (options().length === 0) {
      <p class="m-0 text-sm italic text-slate-500">{{ emptyMessage() }}</p>
    } @else {
      <div class="flex flex-col gap-1">
        @if (selectedOptions().length > 0) {
          <ul class="flex flex-wrap gap-1">
            @for (opt of selectedOptions(); track opt.id) {
              <li>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-3 pr-1 text-xs text-indigo-900 hover:bg-indigo-100"
                  [attr.aria-label]="'Remove ' + opt.label"
                  (click)="remove(opt.id)"
                >
                  {{ opt.label }}
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
            [attr.aria-expanded]="open()"
            [placeholder]="placeholder()"
            class="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            [value]="query()"
            (input)="onQuery($event)"
            (focus)="open.set(true)"
            (blur)="onBlur($event)"
            (keydown)="onKey($event)"
          />
          @if (open()) {
            @if (filtered().length === 0) {
              <p
                class="absolute left-0 right-0 top-full z-10 mt-1 m-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm italic text-slate-500 shadow-md"
              >
                @if (query()) { No matches for "{{ query() }}". } @else { All options selected. }
              </p>
            } @else {
              <ul
                role="listbox"
                class="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 list-none overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-md"
              >
                @for (opt of filtered(); track opt.id; let i = $index) {
                  <li
                    role="option"
                    [class]="optionClass(i === activeIndex())"
                    [attr.aria-selected]="false"
                    (mousedown)="onOptionMouseDown($event, opt.id)"
                    (mouseenter)="activeIndex.set(i)"
                  >
                    <span>{{ opt.label }}</span>
                    @if (opt.hint; as h) {
                      <span class="text-xs text-slate-500">{{ h }}</span>
                    }
                  </li>
                }
              </ul>
            }
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboboxPickerComponent {
  readonly options = input.required<ComboboxOption[]>();
  readonly value = input<string[]>([]);
  readonly placeholder = input<string>('Search…');
  readonly emptyMessage = input<string>('No options available.');
  readonly valueChange = output<string[]>();

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);

  private readonly selectedSet = computed(() => new Set(this.value()));

  protected readonly selectedOptions = computed<ComboboxOption[]>(() => {
    const set = this.selectedSet();
    const byId = new Map(this.options().map((o) => [o.id, o]));
    return this.value()
      .map((id) => byId.get(id) ?? { id, label: id })
      .filter((o) => set.has(o.id));
  });

  protected readonly filtered = computed<ComboboxOption[]>(() => {
    const q = this.query().trim().toLowerCase();
    const set = this.selectedSet();
    return this.options()
      .filter((o) => !set.has(o.id))
      .filter((o) => !q || o.label.toLowerCase().includes(q));
  });

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.open.set(true);
  }

  protected onBlur(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this.open.set(false);
    this.query.set('');
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      const max = this.filtered().length;
      if (max === 0) return;
      this.activeIndex.update((i) => (i + 1) % max);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const max = this.filtered().length;
      if (max === 0) return;
      this.activeIndex.update((i) => (i - 1 + max) % max);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const opt = this.filtered()[this.activeIndex()];
      if (opt) this.add(opt.id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.open.set(false);
      this.query.set('');
    } else if (event.key === 'Backspace' && this.query() === '') {
      const last = this.value()[this.value().length - 1];
      if (last !== undefined) {
        event.preventDefault();
        this.remove(last);
      }
    }
  }

  protected onOptionMouseDown(event: MouseEvent, id: string): void {
    event.preventDefault();
    this.add(id);
  }

  protected add(id: string): void {
    if (this.selectedSet().has(id)) return;
    this.valueChange.emit([...this.value(), id]);
    this.query.set('');
    this.activeIndex.set(0);
  }

  protected remove(id: string): void {
    if (!this.selectedSet().has(id)) return;
    this.valueChange.emit(this.value().filter((x) => x !== id));
  }

  protected optionClass(active: boolean): string {
    const base =
      'flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm';
    return active ? `${base} bg-indigo-50 text-indigo-900` : `${base} text-slate-700`;
  }
}
