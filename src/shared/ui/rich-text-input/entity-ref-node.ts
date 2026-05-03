import { mergeAttributes, Node } from '@tiptap/core';
import { EntityKind } from '@shared/models';
import { INLINE_REF_BASE_CLASS, KIND_TEXT_CLASS } from '@shared/utils';

export interface EntityRefAttrs {
  kind: EntityKind;
  id: string;
  displayText: string;
}

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
    const kind = (node.attrs['kind'] as EntityKind) ?? 'character';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-entity-ref': '',
        class: `${INLINE_REF_BASE_CLASS} ${KIND_TEXT_CLASS[kind]}`,
      }),
      display,
    ];
  },
});
