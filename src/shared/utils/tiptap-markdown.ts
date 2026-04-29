import { Marked, Tokens } from 'marked';
import {
  buildInlineRef,
  INLINE_REF_KIND_BY_PREFIX,
  INLINE_REF_REGEX,
  InlineRefKindPrefix,
} from './inline-refs';

interface InlineRefToken extends Tokens.Generic {
  type: 'inlineRef';
  raw: string;
  prefix: InlineRefKindPrefix;
  id: string;
  displayText: string;
}

interface PMNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string }>;
  content?: PMNode[];
}

export function markdownToTiptapHtml(text: string): string {
  if (!text) return '';
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
          return (
            `<span data-entity-ref="" data-kind="${escapeAttr(kind)}" data-id="${escapeAttr(t.id)}">` +
            escapeHtml(t.displayText) +
            `</span>`
          );
        },
      },
    ],
  });
  return m.parse(text) as string;
}

export function tiptapJsonToMarkdown(doc: PMNode): string {
  if (doc.type !== 'doc' || !doc.content) return '';
  return doc.content
    .map((b) => serializeBlock(b))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function serializeBlock(node: PMNode, indent = ''): string {
  switch (node.type) {
    case 'paragraph':
      return indent + serializeInline(node.content ?? []);
    case 'bulletList':
      return (node.content ?? [])
        .map((li) => serializeListItem(li, indent))
        .join('\n');
    default:
      return '';
  }
}

function serializeListItem(node: PMNode, indent: string): string {
  const children = node.content ?? [];
  if (children.length === 0) return indent + '- ';
  const [first, ...rest] = children;
  const head = indent + '- ' + serializeInline(first.content ?? []);
  if (rest.length === 0) return head;
  const tail = rest
    .map((c) => serializeBlock(c, indent + '  '))
    .filter(Boolean)
    .join('\n');
  return tail ? head + '\n' + tail : head;
}

function serializeInline(nodes: PMNode[]): string {
  return nodes.map(serializeInlineNode).join('');
}

function serializeInlineNode(node: PMNode): string {
  if (node.type === 'hardBreak') return '  \n';
  if (node.type === 'entityRef') {
    const attrs = node.attrs ?? {};
    const kind = (attrs['kind'] as string) || 'character';
    const id = (attrs['id'] as string) || '';
    const displayText = (attrs['displayText'] as string) || '';
    return buildInlineRef(kind as 'character' | 'place' | 'event' | 'story', id, displayText);
  }
  if (node.type === 'text') {
    let text = escapeMarkdown(node.text ?? '');
    const marks = node.marks ?? [];
    const isBold = marks.some((m) => m.type === 'bold');
    const isItalic = marks.some((m) => m.type === 'italic');
    if (isItalic) text = `*${text}*`;
    if (isBold) text = `**${text}**`;
    return text;
  }
  return '';
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}\[\]()#+\-.!])/g, '\\$1');
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

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
