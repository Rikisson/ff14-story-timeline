import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { EntityKind } from '@shared/models';
import {
  INLINE_REF_KIND_BY_PREFIX,
  INLINE_REF_PREFIX_BY_KIND,
  InlineRefKindPrefix,
} from '@shared/utils';

export interface InlineRefOption {
  kind: EntityKind;
  id: string;
  label: string;
  slug?: string;
}

interface TriggerState {
  start: number;
  query: string;
  kind: EntityKind | null;
  filter: string;
  caretCoords: { top: number; left: number };
}

const KIND_PREFIXES: InlineRefKindPrefix[] = ['ch', 'pl', 'ev', 'st'];
const MAX_RESULTS = 8;

@Component({
  selector: 'app-inline-ref-textarea',
  template: `
    <div class="relative">
      <textarea
        #textarea
        [id]="textareaId()"
        [rows]="rows()"
        [value]="value()"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-autocomplete]="'list'"
        [attr.aria-expanded]="trigger() !== null"
        [attr.aria-controls]="trigger() !== null ? popupId : null"
        class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-inherit text-sm leading-relaxed"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        (click)="refreshTrigger()"
        (keyup)="onKeyup($event)"
        (blur)="onBlur()"
      ></textarea>

      @if (trigger(); as t) {
        @if (results().length > 0) {
          <ul
            [id]="popupId"
            role="listbox"
            class="absolute z-20 m-0 max-h-60 w-72 list-none overflow-auto rounded-md border border-slate-300 bg-white p-1 text-sm shadow-lg"
            [style.top.px]="t.caretCoords.top + 22"
            [style.left.px]="t.caretCoords.left"
            (mousedown)="onPopupMouseDown($event)"
          >
            @for (opt of results(); let i = $index; track opt.kind + ':' + opt.id) {
              <li
                role="option"
                [id]="popupId + '-opt-' + i"
                [attr.aria-selected]="i === activeIndex()"
                class="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1"
                [class.bg-indigo-100]="i === activeIndex()"
                (mouseenter)="activeIndex.set(i)"
                (click)="selectOption(opt)"
              >
                <span class="flex-1 truncate text-slate-900">{{ opt.label }}</span>
                <span class="shrink-0 font-mono text-xs text-slate-500">
                  {{ kindBadge(opt.kind) }}@if (opt.slug) { · {{ opt.slug }} }
                </span>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    textarea {
      resize: vertical;
      font: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineRefTextareaComponent {
  readonly value = input.required<string>();
  readonly options = input<InlineRefOption[]>([]);
  readonly rows = input<number>(4);
  readonly placeholder = input<string>('');
  readonly textareaId = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly valueChange = output<string>();

  private readonly textareaRef = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly popupId = `inline-ref-popup-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly trigger = signal<TriggerState | null>(null);
  protected readonly activeIndex = signal<number>(0);

  protected readonly results = computed<InlineRefOption[]>(() => {
    const t = this.trigger();
    if (!t) return [];
    const filter = t.filter.toLowerCase();
    const matches = this.options().filter((o) => {
      if (t.kind !== null && o.kind !== t.kind) return false;
      if (!filter) return true;
      return (
        o.label.toLowerCase().includes(filter) ||
        (o.slug?.toLowerCase().includes(filter) ?? false)
      );
    });
    return matches.slice(0, MAX_RESULTS);
  });

  constructor() {
    effect(() => {
      this.results();
      this.activeIndex.set(0);
    });
  }

  protected onInput(event: Event): void {
    const ta = event.target as HTMLTextAreaElement;
    this.valueChange.emit(ta.value);
    this.computeTrigger(ta);
  }

  protected onKeyup(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
      this.refreshTrigger();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const t = this.trigger();
    const list = this.results();
    if (!t || list.length === 0) {
      if (event.key === 'Escape' && t) {
        this.trigger.set(null);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((i) => (i + 1) % list.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((i) => (i - 1 + list.length) % list.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      const opt = list[this.activeIndex()];
      if (opt) this.selectOption(opt);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.trigger.set(null);
    }
  }

  protected onBlur(): void {
    setTimeout(() => this.trigger.set(null), 120);
  }

  protected refreshTrigger(): void {
    this.computeTrigger(this.textareaRef().nativeElement);
  }

  protected onPopupMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }

  protected selectOption(opt: InlineRefOption): void {
    const t = this.trigger();
    const ta = this.textareaRef().nativeElement;
    if (!t) return;
    const before = ta.value.slice(0, t.start);
    const after = ta.value.slice(ta.selectionStart);
    const prefix = INLINE_REF_PREFIX_BY_KIND[opt.kind];
    const insertion = `\${${prefix}:${opt.id}}[]`;
    const newValue = before + insertion + after;
    const caretPos = before.length + insertion.length - 1;
    this.valueChange.emit(newValue);
    this.trigger.set(null);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(caretPos, caretPos);
    }, 0);
  }

  protected kindBadge(kind: EntityKind): string {
    return INLINE_REF_PREFIX_BY_KIND[kind];
  }

  private computeTrigger(ta: HTMLTextAreaElement): void {
    const caret = ta.selectionStart;
    if (caret !== ta.selectionEnd) {
      this.trigger.set(null);
      return;
    }
    const before = ta.value.slice(0, caret);
    const start = before.lastIndexOf('${');
    if (start === -1) {
      this.trigger.set(null);
      return;
    }
    const between = before.slice(start + 2);
    if (/[\n\}\]]/.test(between)) {
      this.trigger.set(null);
      return;
    }
    const colonIdx = between.indexOf(':');
    if (colonIdx !== -1) {
      this.trigger.set(null);
      return;
    }
    const { kind, filter } = this.parseQuery(between);
    const caretCoords = this.getCaretCoords(ta, caret);
    this.trigger.set({ start, query: between, kind, filter, caretCoords });
  }

  private parseQuery(query: string): { kind: EntityKind | null; filter: string } {
    const head = query.slice(0, 2).toLowerCase();
    if (KIND_PREFIXES.includes(head as InlineRefKindPrefix)) {
      return {
        kind: INLINE_REF_KIND_BY_PREFIX[head as InlineRefKindPrefix],
        filter: query.slice(2),
      };
    }
    return { kind: null, filter: query };
  }

  private getCaretCoords(
    ta: HTMLTextAreaElement,
    pos: number,
  ): { top: number; left: number } {
    const mirror = document.createElement('div');
    const cs = getComputedStyle(ta);
    const propsToCopy = [
      'boxSizing',
      'width',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'fontStretch',
      'fontSize',
      'fontSizeAdjust',
      'lineHeight',
      'fontFamily',
      'textAlign',
      'textTransform',
      'textIndent',
      'letterSpacing',
      'wordSpacing',
      'tabSize',
    ] as const;
    const style = mirror.style as unknown as Record<string, string>;
    for (const p of propsToCopy) style[p] = cs.getPropertyValue(this.kebab(p));
    style['position'] = 'absolute';
    style['visibility'] = 'hidden';
    style['whiteSpace'] = 'pre-wrap';
    style['wordWrap'] = 'break-word';
    style['overflow'] = 'hidden';
    style['top'] = '0';
    style['left'] = '-9999px';

    mirror.textContent = ta.value.slice(0, pos);
    const marker = document.createElement('span');
    marker.textContent = ta.value.slice(pos) || '.';
    mirror.appendChild(marker);

    document.body.appendChild(mirror);
    const top = marker.offsetTop;
    const left = marker.offsetLeft;
    document.body.removeChild(mirror);

    return { top: top - ta.scrollTop, left: left - ta.scrollLeft };
  }

  private kebab(camel: string): string {
    return camel.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  }
}
