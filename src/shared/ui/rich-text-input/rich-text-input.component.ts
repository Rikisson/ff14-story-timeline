import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
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
import { Editor } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Italic from '@tiptap/extension-italic';
import ListItem from '@tiptap/extension-list-item';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { InlineRefOption, markdownToTiptapHtml, tiptapJsonToMarkdown } from '@shared/utils';
import { EntityRefNode } from './entity-ref-node';
import { createSuggestionRender } from './ref-suggestion-renderer';
import { RefSuggestion } from './ref-suggestion.extension';

@Component({
  selector: 'app-rich-text-input',
  template: `
    <div
      class="flex flex-col gap-1 rounded-md border border-slate-300 bg-white"
      [class.opacity-60]="!ready()"
    >
      <div
        class="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1"
        role="toolbar"
        [attr.aria-label]="ariaLabel() ? ariaLabel() + ' formatting' : null"
      >
        <button
          type="button"
          class="rounded px-2 py-1 text-sm font-semibold hover:bg-slate-100"
          [class.bg-slate-200]="boldActive()"
          [attr.aria-pressed]="boldActive()"
          aria-label="Bold (Ctrl+B)"
          (click)="toggleBold()"
        >
          B
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-sm italic hover:bg-slate-100"
          [class.bg-slate-200]="italicActive()"
          [attr.aria-pressed]="italicActive()"
          aria-label="Italic (Ctrl+I)"
          (click)="toggleItalic()"
        >
          I
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-sm hover:bg-slate-100"
          [class.bg-slate-200]="bulletListActive()"
          [attr.aria-pressed]="bulletListActive()"
          aria-label="Bullet list"
          (click)="toggleBulletList()"
        >
          • List
        </button>
        <span class="ml-auto text-xs text-slate-500">
          Type <code>$&#123;</code> for entity refs
        </span>
      </div>
      <div
        #host
        class="rich-text-host min-h-20 px-3 py-2 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-indigo-300"
        [attr.aria-label]="ariaLabel() || null"
      ></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .rich-text-host :focus-visible {
      outline: none;
    }
    .rich-text-host .ProseMirror {
      outline: none;
      min-height: 4rem;
    }
    .rich-text-host .ProseMirror p {
      margin: 0 0 0.5em;
    }
    .rich-text-host .ProseMirror p:last-child {
      margin-bottom: 0;
    }
    .rich-text-host .ProseMirror ul {
      margin: 0 0 0.5em;
      padding-left: 1.25rem;
      list-style: disc;
    }
    .rich-text-host .ProseMirror p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: rgb(148 163 184);
      pointer-events: none;
      float: left;
      height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextInputComponent {
  readonly value = input.required<string>();
  readonly options = input<InlineRefOption[]>([]);
  readonly placeholder = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly valueChange = output<string>();

  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private editor: Editor | null = null;
  private readonly optionsRef: { current: InlineRefOption[] } = { current: [] };
  private lastEmitted = '';

  protected readonly ready = signal(false);
  protected readonly boldActive = signal(false);
  protected readonly italicActive = signal(false);
  protected readonly bulletListActive = signal(false);

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

  protected toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  private initEditor(): void {
    const initialMd = this.value();
    this.editor = new Editor({
      element: this.hostRef().nativeElement,
      extensions: [
        Document,
        Paragraph,
        Text,
        HardBreak,
        Bold,
        Italic,
        BulletList,
        ListItem,
        History,
        Placeholder.configure({ placeholder: this.placeholder() }),
        EntityRefNode,
        RefSuggestion.configure({
          optionsRef: this.optionsRef,
          renderFactory: createSuggestionRender,
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
    this.bulletListActive.set(editor.isActive('bulletList'));
  }
}
