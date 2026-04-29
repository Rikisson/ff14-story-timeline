import { Marked, Tokens } from 'marked';
import {
  INLINE_REF_KIND_BY_PREFIX,
  INLINE_REF_REGEX,
  InlineRefKindPrefix,
} from './inline-refs';

export interface MarkdownRefOption {
  kind: 'character' | 'place' | 'event' | 'story';
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

const ANCHOR_CLASS =
  'text-indigo-700 underline decoration-dotted underline-offset-2 hover:bg-indigo-50';

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
          const idx = src.search(/\$\{(ch|pl|ev|st):/);
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
            return `<a class="${ANCHOR_CLASS}" title="${escapeHtml(match.label)}">${display}</a>`;
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
