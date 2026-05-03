import { Marked, Tokens } from 'marked';
import { EntityKind } from '../models/entity-ref';
import { INLINE_REF_BASE_CLASS, KIND_TEXT_CLASS } from './entity-kind-palette';
import {
  INLINE_REF_KIND_BY_PREFIX,
  INLINE_REF_REGEX,
  InlineRefKindPrefix,
} from './inline-refs';

export interface MarkdownRefOption {
  kind: EntityKind;
  id: string;
  label: string;
}

interface InlineRefToken extends Tokens.Generic {
  type: 'inlineRef';
  raw: string;
  prefix: InlineRefKindPrefix;
  id: string;
  displayText: string;
}

export function renderMarkdown(text: string, options: MarkdownRefOption[] = []): string {
  if (!text) return '';
  const lookup = new Map<string, MarkdownRefOption>();
  for (const o of options) lookup.set(`${o.kind}:${o.id}`, o);

  const m = new Marked({ gfm: true, breaks: true, async: false });
  m.use({
    extensions: [
      {
        name: 'inlineRef',
        level: 'inline',
        start(src: string) {
          const idx = src.search(/\$\{(?:ch|pl|ev|st|pt|it|fa|cx):/);
          return idx === -1 ? undefined : idx;
        },
        tokenizer(src: string): InlineRefToken | undefined {
          const re = new RegExp('^' + INLINE_REF_REGEX.source);
          const match = re.exec(src);
          if (!match) return undefined;
          return {
            type: 'inlineRef',
            raw: match[0],
            prefix: match[1] as InlineRefKindPrefix,
            id: match[2],
            displayText: match[3],
          };
        },
        renderer(token: Tokens.Generic): string {
          const t = token as InlineRefToken;
          const kind = INLINE_REF_KIND_BY_PREFIX[t.prefix];
          const match = lookup.get(`${kind}:${t.id}`);
          const display = escapeHtml(t.displayText || match?.label || '');
          if (match) {
            return `<a class="${INLINE_REF_BASE_CLASS} ${KIND_TEXT_CLASS[kind]}" data-entity-ref-kind="${kind}" data-entity-ref-id="${escapeHtml(t.id)}" tabindex="0" title="${escapeHtml(match.label)}">${display}</a>`;
          }
          return `[${display}]`;
        },
      },
    ],
  });

  return m.parse(text) as string;
}

export function renderMarkdownInline(text: string, options: MarkdownRefOption[] = []): string {
  if (!text) return '';
  const full = renderMarkdown(text, options);
  return full.replace(/^\s*<p>([\s\S]*?)<\/p>\s*$/u, '$1');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}
