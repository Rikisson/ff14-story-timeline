import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Editor } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Italic from '@tiptap/extension-italic';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { UniverseStore } from '@features/universes';
import { EntityDirectoryService } from '@shared/data-access';
import { InlineRefOption, markdownToTiptapHtml, tiptapJsonToMarkdown } from '@shared/utils';
import { EntityRefNode } from './entity-ref-node';
import { createSuggestionRender } from './ref-suggestion-renderer';
import { FetchInlineRefOptions, RefSuggestion } from './ref-suggestion.extension';

@Component({
  selector: 'app-rich-text-input',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <div
        class="flex flex-col gap-1 rounded-md border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-accent-ring"
        [class.opacity-60]="!ready()"
      >
        <div
          class="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1"
          role="toolbar"
          [attr.aria-label]="toolbarAriaLabel()"
        >
          <button
            type="button"
            class="rounded px-2 py-1 text-sm font-semibold text-foreground hover:bg-surface-muted"
            [class.bg-surface-strong]="boldActive()"
            [attr.aria-pressed]="boldActive()"
            [attr.aria-label]="t('tooltip.tiptapBold')"
            (click)="toggleBold()"
          >
            B
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-sm italic text-foreground hover:bg-surface-muted"
            [class.bg-surface-strong]="italicActive()"
            [attr.aria-pressed]="italicActive()"
            [attr.aria-label]="t('tooltip.tiptapItalic')"
            (click)="toggleItalic()"
          >
            I
          </button>
          <span class="ml-auto text-xs text-foreground-faint">
            {{ t('message.tiptapRefHint') }}
          </span>
        </div>
        <div
          #host
          class="rich-text-host min-h-20 px-3 py-2 text-sm leading-relaxed text-foreground"
          [attr.aria-label]="ariaLabel() || null"
        ></div>
      </div>
    </ng-container>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextInputComponent {
  readonly value = input.required<string>();
  /**
   * Legacy pre-loaded suggestion list. Kept for tests and any caller
   * that wants to inject a fixed set; live editor surfaces should leave
   * this empty and let the directory-backed fetcher do the work.
   */
  readonly options = input<InlineRefOption[]>([]);
  readonly placeholder = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly valueChange = output<string>();

  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly directory = inject(EntityDirectoryService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private editor: Editor | null = null;
  private readonly optionsRef: { current: InlineRefOption[] } = { current: [] };
  private lastEmitted = '';

  protected readonly ready = signal(false);
  protected readonly boldActive = signal(false);
  protected readonly italicActive = signal(false);

  protected readonly toolbarAriaLabel = computed(() => {
    const field = this.ariaLabel();
    if (!field) return null;
    return this.transloco.translate('general.tooltip.tiptapToolbar', { field });
  });

  constructor() {
    if (this.isBrowser) {
      afterNextRender(() => this.initEditor());
      this.destroyRef.onDestroy(() => this.editor?.destroy());
    }

    effect(() => {
      this.optionsRef.current = this.options();
    });

    effect(() => {
      const v = this.value();
      const ed = this.editor;
      if (!ed) return;
      if (v === this.lastEmitted) return;
      const currentMd = tiptapJsonToMarkdown(ed.getJSON() as never);
      if (v === currentMd) return;
      ed.commands.setContent(markdownToTiptapHtml(v), { emitUpdate: false });
    });
  }

  protected toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  protected toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  private initEditor(): void {
    const initialMd = this.value();
    const renderer = createSuggestionRender({
      getNoMatchesLabel: () => this.transloco.translate('general.empty.tiptapNoMatches'),
    });
    const fetchOptions: FetchInlineRefOptions = async (_query, kind, filter) => {
      const universeId = this.universes.activeUniverseId();
      if (!universeId) return [];
      const rows = await this.directory.prefixSearch({
        universeId,
        query: filter,
        kind: kind ?? undefined,
        // Authors editing inline refs are universe members; surfacing draft
        // entities matches the picker UX (a *Draft* badge is not part of
        // the suggestion row, but the inserted ref still renders plain for
        // public readers if the target is non-public).
        includeDrafts: true,
      });
      return rows.map<InlineRefOption>((r) => ({
        kind: r.kind,
        id: r.id,
        label: r.label,
        slug: r.slug,
      }));
    };
    this.editor = new Editor({
      element: this.hostRef().nativeElement,
      extensions: [
        Document,
        Paragraph,
        Text,
        HardBreak,
        Bold,
        Italic,
        History,
        Placeholder.configure({ placeholder: this.placeholder() }),
        EntityRefNode,
        RefSuggestion.configure({
          fetchOptions,
          optionsRef: this.optionsRef,
          renderFactory: () => renderer,
        }),
      ],
      content: markdownToTiptapHtml(initialMd),
      onUpdate: ({ editor }) => {
        const md = tiptapJsonToMarkdown(editor.getJSON() as never);
        if (md === this.lastEmitted) return;
        this.lastEmitted = md;
        this.valueChange.emit(md);
      },
      onSelectionUpdate: ({ editor }) => this.refreshToolbar(editor),
      onTransaction: ({ editor }) => this.refreshToolbar(editor),
    });
    this.lastEmitted = initialMd;
    this.refreshToolbar(this.editor);
    this.ready.set(true);
  }

  private refreshToolbar(editor: Editor): void {
    this.boldActive.set(editor.isActive('bold'));
    this.italicActive.set(editor.isActive('italic'));
  }
}
