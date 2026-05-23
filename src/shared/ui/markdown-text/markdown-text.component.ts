import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EntityResolverCache } from '@shared/data-access';
import { EntityKind, EntityRef } from '@shared/models';
import { InlineRefOption, parseRefs, renderMarkdown, renderMarkdownInline } from '@shared/utils';
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
  /**
   * Caller-supplied label overrides. When omitted, the component
   * resolves any inline refs in `text` through `EntityResolverCache`
   * itself, so detail surfaces don't have to precompute the option list.
   */
  readonly options = input<InlineRefOption[]>([]);
  readonly inline = input<boolean>(false);
  // Renders refs as plain text so a ref inside a hover popover can't
  // spawn another popover from within it.
  readonly flattenRefs = input<boolean>(false);

  private readonly hover = inject(EntityRefHoverService);
  private readonly resolver = inject(EntityResolverCache);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly textRefs = computed<EntityRef[]>(() => {
    const seen = new Set<string>();
    const out: EntityRef[] = [];
    for (const seg of parseRefs(this.text())) {
      if (!('ref' in seg)) continue;
      const key = `${seg.ref.kind}:${seg.ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(seg.ref);
    }
    return out;
  });
  private readonly resolvedRefs = this.resolver.resolveMany(this.textRefs);

  protected readonly html = computed<SafeHtml>(() => {
    const explicit = this.options();
    const merged = explicit.length > 0
      ? explicit.map((o) => ({ kind: o.kind, id: o.id, label: o.label }))
      : this.optionsFromResolver();
    const raw = this.inline()
      ? renderMarkdownInline(this.text(), merged, this.flattenRefs())
      : renderMarkdown(this.text(), merged, this.flattenRefs());
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });

  private optionsFromResolver(): { kind: EntityKind; id: string; label: string }[] {
    const resolved = this.resolvedRefs();
    // Refs that don't resolve to a directory row are deliberately
    // omitted — `renderMarkdown` falls back to `[displayText]` plain
    // text when no option matches, which matches *Inline-ref tokens —
    // Entity delete* ("Refs become unresolvable and render plain") and
    // avoids fabricating an anchor + tooltip with the entity ID stuffed
    // into the label.
    const out: { kind: EntityKind; id: string; label: string }[] = [];
    for (const r of this.textRefs()) {
      const row = resolved.get(`${r.kind}:${r.id}`);
      if (!row) continue;
      out.push({ kind: r.kind, id: r.id, label: row.label });
    }
    return out;
  }

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
