import { mergeAttributes, Node, NodeViewRenderer } from '@tiptap/core';
import { EntityKind } from '@shared/models';
import { INLINE_REF_BASE_CLASS, KIND_TEXT_CLASS } from '@shared/utils';

export interface EntityRefAttrs {
  kind: EntityKind;
  id: string;
  displayText: string;
}

export interface EntityRefEditRequestInternal {
  kind: EntityKind;
  id: string;
  displayText: string;
  anchor: HTMLElement;
  onSave: (next: string) => void;
}

export interface EntityRefNodeOptions {
  onEditRequest: ((request: EntityRefEditRequestInternal) => void) | null;
}

export const EntityRefNode = Node.create<EntityRefNodeOptions>({
  name: 'entityRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { onEditRequest: null };
  },

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

  addNodeView(): NodeViewRenderer {
    return ({ node, getPos, editor, HTMLAttributes }) => {
      const kind = (node.attrs['kind'] as EntityKind) ?? 'character';
      const dom = document.createElement('span');
      Object.entries(
        mergeAttributes(HTMLAttributes, {
          'data-entity-ref': '',
          class: `${INLINE_REF_BASE_CLASS} ${KIND_TEXT_CLASS[kind]} cursor-pointer`,
        }) as Record<string, string>,
      ).forEach(([k, v]) => dom.setAttribute(k, v));
      dom.textContent = (node.attrs['displayText'] as string) || '';

      const onClick = (event: MouseEvent): void => {
        if (!editor.isEditable) return;
        event.preventDefault();
        event.stopPropagation();
        const onEditRequest = (editor.extensionManager.extensions.find(
          (e) => e.name === 'entityRef',
        )?.options as EntityRefNodeOptions | undefined)?.onEditRequest;
        if (!onEditRequest) return;
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos === null || pos === undefined) return;
        onEditRequest({
          kind: node.attrs['kind'] as EntityKind,
          id: node.attrs['id'] as string,
          displayText: (node.attrs['displayText'] as string) || '',
          anchor: dom,
          onSave: (next) => {
            editor
              .chain()
              .focus()
              .command(({ tr }) => {
                tr.setNodeAttribute(pos, 'displayText', next);
                return true;
              })
              .run();
          },
        });
      };

      dom.addEventListener('mousedown', (event) => event.preventDefault());
      dom.addEventListener('click', onClick);

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'entityRef') return false;
          const nextKind = (updatedNode.attrs['kind'] as EntityKind) ?? 'character';
          dom.className = `${INLINE_REF_BASE_CLASS} ${KIND_TEXT_CLASS[nextKind]} cursor-pointer`;
          dom.setAttribute('data-kind', nextKind);
          dom.setAttribute('data-id', (updatedNode.attrs['id'] as string) ?? '');
          dom.textContent = (updatedNode.attrs['displayText'] as string) || '';
          return true;
        },
        destroy() {
          dom.removeEventListener('click', onClick);
        },
      };
    };
  },
});
