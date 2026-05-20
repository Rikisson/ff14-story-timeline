import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EntityResolverCache } from '@shared/data-access';
import { EntityRefHoverService } from '../entity-ref/entity-ref-hover.service';
import { EntityKind, EntityRef } from '@shared/models';
import { InlineRefOption, parseRefs, renderMarkdown } from '@shared/utils';
import { TextSpeed } from '@features/stories';

/**
 * Characters per second per authored speed. `'instant'` is the
 * skip-typing branch and never enters the rAF loop.
 *   - slow: classic VN crawl, comfortable for first-time readers
 *   - normal: brisk; the everyday default
 *   - fast: ~2 chars per frame at 60 Hz — visibly animated but
 *     close to instant for short lines
 */
const CPS: Record<Exclude<TextSpeed, 'instant'>, number> = {
  slow: 12,
  normal: 60,
  fast: 120,
};

/**
 * Renders scene markdown with the same inline-ref pipeline as
 * `app-markdown-text` and progressively reveals characters per the
 * authored `speed`. `complete()` skips the rest of the reveal; the
 * parent calls it on a player-area click so the standard VN
 * "click-to-skip" gesture works.
 */
@Component({
  selector: 'app-typewriter-text',
  template: `
    <div
      #host
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
    .tw-ch {
      display: inline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypewriterTextComponent {
  readonly text = input.required<string>();
  readonly options = input<InlineRefOption[]>([]);
  readonly speed = input<TextSpeed>('fast');
  readonly done = output<void>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly hover = inject(EntityRefHoverService);
  private readonly resolver = inject(EntityResolverCache);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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
    const raw = renderMarkdown(this.text(), merged);
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });

  private rafId: number | null = null;
  private spans: HTMLSpanElement[] = [];
  private revealIdx = 0;

  constructor() {
    effect(() => {
      // `html()` is consumed by the bound `[innerHTML]` and lands in the
      // DOM before this effect's body runs (Angular flushes bindings
      // before effects). Reading speed() keeps it a dependency.
      this.html();
      this.speed();
      queueMicrotask(() => this.restartReveal());
    });
    this.destroyRef.onDestroy(() => this.cancelReveal());
  }

  /**
   * Reveal everything immediately. Called from outside on player-area
   * click so the standard VN "click-to-skip" gesture works.
   * Returns `true` if any characters were still hidden — lets the caller
   * decide whether the click also advances the scene.
   */
  complete(): boolean {
    if (this.revealIdx >= this.spans.length) return false;
    this.cancelReveal();
    for (let i = this.revealIdx; i < this.spans.length; i++) {
      this.spans[i].style.visibility = 'visible';
    }
    this.revealIdx = this.spans.length;
    this.done.emit();
    return true;
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

  private optionsFromResolver(): { kind: EntityKind; id: string; label: string }[] {
    const resolved = this.resolvedRefs();
    const out: { kind: EntityKind; id: string; label: string }[] = [];
    for (const r of this.textRefs()) {
      const row = resolved.get(`${r.kind}:${r.id}`);
      if (!row) continue;
      out.push({ kind: r.kind, id: r.id, label: row.label });
    }
    return out;
  }

  private restartReveal(): void {
    this.cancelReveal();
    const host = this.host().nativeElement;
    // `[innerHTML]` re-renders fresh markup on text/options changes,
    // dropping the `.tw-ch` spans; a speed-only change leaves them in
    // place. Re-wrap only when they're absent — a second walk over
    // already-wrapped characters would nest the spans.
    if (host.querySelector('.tw-ch') === null) {
      this.spans = wrapChars(host);
    }
    this.revealIdx = 0;
    for (const span of this.spans) span.style.visibility = 'hidden';
    if (this.spans.length === 0) {
      this.done.emit();
      return;
    }
    if (this.speed() === 'instant') {
      this.complete();
      return;
    }
    if (!this.isBrowser) {
      // SSR / test envs without rAF still reveal everything so output is
      // observable; the animation is purely a browser polish.
      this.complete();
      return;
    }
    const cps = CPS[this.speed() as Exclude<TextSpeed, 'instant'>];
    let lastTick: number | null = null;
    let budget = 0;
    const tick = (now: number): void => {
      if (lastTick === null) lastTick = now;
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      budget += delta * cps;
      while (budget >= 1 && this.revealIdx < this.spans.length) {
        this.spans[this.revealIdx].style.visibility = 'visible';
        this.revealIdx++;
        budget -= 1;
      }
      if (this.revealIdx >= this.spans.length) {
        this.rafId = null;
        this.done.emit();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private cancelReveal(): void {
    if (this.rafId !== null && this.isBrowser && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }
}

function wrapChars(root: HTMLElement): HTMLSpanElement[] {
  const spans: HTMLSpanElement[] = [];
  if (!root.ownerDocument) return spans;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode()) !== null) textNodes.push(n as Text);
  for (const tn of textNodes) {
    const parent = tn.parentNode;
    if (!parent) continue;
    const raw = tn.nodeValue ?? '';
    if (raw.length === 0) continue;
    const frag = root.ownerDocument.createDocumentFragment();
    for (const ch of raw) {
      const span = root.ownerDocument.createElement('span');
      span.className = 'tw-ch';
      span.textContent = ch;
      span.style.visibility = 'hidden';
      frag.appendChild(span);
      spans.push(span);
    }
    parent.replaceChild(frag, tn);
  }
  return spans;
}

function findRefAnchor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const el = target.closest<HTMLElement>('[data-entity-ref-kind]');
  return el ?? null;
}
