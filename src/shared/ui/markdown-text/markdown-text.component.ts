import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EntityKind } from '@shared/models';
import { InlineRefOption, renderMarkdown, renderMarkdownInline } from '@shared/utils';
import { EntityRefHoverService } from '../entity-ref/entity-ref-hover.service';

@Component({
  selector: 'app-markdown-text',
  template: `
    <div
      class="markdown-body"
      [innerHTML]="html()"
      (mouseover)="onPointer($event)"
      (mouseout)="onLeave($event)"
      (focusin)="onPointer($event)"
      (focusout)="onLeave($event)"
    ></div>
  `,
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

  private readonly hover = inject(EntityRefHoverService);

  protected readonly html = computed(() => {
    const opts = this.options().map((o) => ({ kind: o.kind, id: o.id, label: o.label }));
    return this.inline()
      ? renderMarkdownInline(this.text(), opts)
      : renderMarkdown(this.text(), opts);
  });

  protected onPointer(event: Event): void {
    const target = findRefAnchor(event.target);
    if (!target) return;
    const kind = target.dataset['entityRefKind'] as EntityKind | undefined;
    const id = target.dataset['entityRefId'];
    if (!kind || !id) return;
    this.hover.show({ kind, id }, target);
  }

  protected onLeave(event: Event): void {
    const target = findRefAnchor(event.target);
    if (!target) return;
    this.hover.scheduleClose();
  }
}

function findRefAnchor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const el = target.closest<HTMLElement>('[data-entity-ref-kind]');
  return el ?? null;
}
