import { mergeAttributes, Node } from '@tiptap/core';
import { EntityKind } from '@shared/models';

export interface EntityRefAttrs {
  kind: EntityKind;
  id: string;
  displayText: string;
}

const CHIP_CLASS =
  'inline-block rounded bg-indigo-100 px-1 py-0.5 text-indigo-800 text-sm font-medium align-baseline';

export const EntityRefNode = Node.create({
  name: 'entityRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      kind: {
        default: 'character',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-kind') ?? 'character',
        renderHTML: (attrs) => ({ 'data-kind': attrs['kind'] }),
      },
      id: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-id') ?? '',
        renderHTML: (attrs) => ({ 'data-id': attrs['id'] }),
      },
      displayText: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-entity-ref]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const display = (node.attrs['displayText'] as string) || '';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-entity-ref': '',
        class: CHIP_CLASS,
      }),
      display,
    ];
  },
});
