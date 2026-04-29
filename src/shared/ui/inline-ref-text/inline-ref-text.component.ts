import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseRefs } from '@shared/utils';
import { InlineRefOption } from '../inline-ref-textarea/inline-ref-textarea.component';

interface RenderableLiteral {
  kind: 'literal';
  text: string;
}

interface RenderableRef {
  kind: 'ref';
  resolved: boolean;
  displayText: string;
  resolvedName: string;
  fallback: string;
}

type Renderable = RenderableLiteral | RenderableRef;

@Component({
  selector: 'app-inline-ref-text',
  template: `@for (item of items(); track $index) {@if (item.kind === 'literal') {<ng-container>{{ item.text }}</ng-container>}@else if (item.resolved) {<a class="text-indigo-700 underline decoration-dotted underline-offset-2 hover:bg-indigo-50" [title]="item.resolvedName">{{ item.displayText }}</a>}@else {<ng-container>{{ item.fallback }}</ng-container>}}`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineRefTextComponent {
  readonly text = input.required<string>();
  readonly options = input<InlineRefOption[]>([]);

  protected readonly items = computed<Renderable[]>(() => {
    const segments = parseRefs(this.text());
    const opts = this.options();
    const lookup = new Map<string, InlineRefOption>();
    for (const o of opts) lookup.set(`${o.kind}:${o.id}`, o);
    return segments.map<Renderable>((s) => {
      if ('literal' in s) return { kind: 'literal', text: s.literal };
      const match = lookup.get(`${s.ref.kind}:${s.ref.id}`);
      const display = s.displayText || match?.label || '';
      if (!match) {
        return {
          kind: 'ref',
          resolved: false,
          displayText: display,
          resolvedName: '',
          fallback: `[${display}]`,
        };
      }
      return {
        kind: 'ref',
        resolved: true,
        displayText: display,
        resolvedName: match.label,
        fallback: `[${display}]`,
      };
    });
  });
}
