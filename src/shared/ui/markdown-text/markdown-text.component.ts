import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InlineRefOption, renderMarkdown, renderMarkdownInline } from '@shared/utils';

@Component({
  selector: 'app-markdown-text',
  template: `<div class="markdown-body" [innerHTML]="html()"></div>`,
  styles: `
    :host {
      display: block;
    }
    .markdown-body :first-child {
      margin-top: 0;
    }
    .markdown-body :last-child {
      margin-bottom: 0;
    }
    .markdown-body p {
      margin: 0 0 0.75em;
      line-height: 1.55;
    }
    .markdown-body ul {
      margin: 0 0 0.75em;
      padding-left: 1.25rem;
      list-style: disc;
    }
    .markdown-body li {
      margin: 0.125em 0;
    }
    .markdown-body strong {
      font-weight: 600;
    }
    .markdown-body em {
      font-style: italic;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownTextComponent {
  readonly text = input.required<string>();
  readonly options = input<InlineRefOption[]>([]);
  readonly inline = input<boolean>(false);

  protected readonly html = computed(() => {
    const opts = this.options().map((o) => ({ kind: o.kind, id: o.id, label: o.label }));
    return this.inline()
      ? renderMarkdownInline(this.text(), opts)
      : renderMarkdown(this.text(), opts);
  });
}
